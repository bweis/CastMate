import { reactify } from "./reactive.js";
import { cleanSchemaForIPC, makeIPCEnumFunctions, constructDefaultSchema } from "./schema.js"
import _ from 'lodash'
import { ipcMain } from "./electronBridge.js"
import logger from '../utils/logger.js'
import path from 'path'
import { userFolder } from '../utils/configuration.js'
import { FileCache } from "./filecache.js";

export class Plugin
{
	constructor(config)
	{
		this.pluginObj = {};

		this.name = config.name;
		this.pluginObj.name = config.name;
		this.uiName = config.uiName || config.name;
		this.color = config.color;
		this.icon = config.icon;
		logger.info(`Loading Plugin: ${config.name}`);
		this.initFunc = config.init;
		//Bind the init func to the pluginObj
		if (this.initFunc)
		{
			this.initFunc = this.initFunc.bind(this.pluginObj);
		}

		this._bindFunction(config, "onSettingsReload");
		this._bindFunction(config, "onSecretsReload");

		this._bindFunction(config, "onProfilesChanged");
		this._bindFunction(config, "onProfileLoad");

		this._bindFunction(config, "onWebsocketMessage");
		this._bindFunction(config, "onWebsocketConnected");


		this.settingsView = config.settingsView;

		this.settings = config.settings || [];
		this.secrets = config.secrets || [];
		this.triggers = {};

		this.pluginObj.triggers = {};

		this.setupTriggers(config);
		this.setupCaching(config);

		this.actions = {};

		//Pass the methods onto the plugin object for use.
		if (config.methods)
		{
			Object.assign(this.pluginObj, config.methods);
		}

		//Bind all the action handlers to the pluginObj so 'this' works correctly.
		for (let actionKey in config.actions)
		{
			let action = config.actions[actionKey];
			if (action.handler)
			{
				action.handler = action.handler.bind(this.pluginObj);
			}
			if (action.data)
			{
				makeIPCEnumFunctions(this.pluginObj, this.name + "_action_" + actionKey, action.data);
			}
			this.actions[actionKey] = action;
		}

		this._bindAllFunctions(config, "templateFunctions")
		this._bindAllFunctions(config, "ipcMethods", (key, func) => {
			this.pluginObj[key] = func;
			ipcMain.handle(`${this.name}_${key}`, async (event, ...args) =>
			{
				return await func(...args);
			})
		});

		this._bindAllFunctions(config, "publicMethods", (key, func) => {
			this.pluginObj[key] = func;
		});


		this.pluginObj.logger = logger;

		for (let settingsKey in this.settings)
		{
			makeIPCEnumFunctions(this.pluginObj, this.name + "_settings_" + settingsKey, this.settings[settingsKey]);
		}
		for (let secretsKey in this.secrets)
		{
			makeIPCEnumFunctions(this.pluginObj, this.name + "_settings_" + secretsKey, this.secrets[secretsKey]);
		}

		//Create all the state.
		this.stateSchemas = {};
		this.pluginObj.state = {};
		for (let stateKey in config.state)
		{
			this.stateSchemas[stateKey] = config.state[stateKey];
			makeIPCEnumFunctions(this.pluginObj, this.name + "_state_" + stateKey, this.stateSchemas[stateKey]);
			this.pluginObj.state[stateKey] = constructDefaultSchema(config.state[stateKey]);
		}
		this.state = this.pluginObj.state;
		reactify(this.pluginObj.state);
	}

	async init(settings, secrets, actions, profiles, webServices, analytics, plugins)
	{
		let pluginSettings = settings.data[this.name] || {};
		let pluginSecrets = secrets.data[this.name] || {};

		this.pluginObj.settings = pluginSettings;
		this.pluginObj.secrets = pluginSecrets;
		this.pluginObj.webServices = webServices;
		this.pluginObj.actions = actions;
		this.pluginObj.profiles = profiles;
		this.pluginObj.plugins = plugins;
		this.pluginObj.analytics = analytics;

		if (this.initFunc)
		{
			try
			{
				await this.initFunc();
			} catch (err)
			{
				// TODO: Throw exception to UI
				logger.error(`Error loading ${this.name} plugin. Error Msg: ${err}.`)
			}
		}
	}

	setupCaching(config) {
		this.pluginObj.getCache = function(name, secret = false) {
			const filePath = path.join(userFolder, secret ? 'secrets' : 'cache', `${config.name}.${name}.yaml`);
			return new FileCache(filePath, secret);
		}
	}

	setupTriggers(config) {
		for (let triggerName in config.triggers)
		{
			const triggerSpec = config.triggers[triggerName];

			const triggerObj = {
				name: triggerSpec.name,
				description: triggerSpec.description || "",
				context: triggerSpec.context || { },
			}

			if (triggerSpec.config)
			{
				triggerObj.config = triggerSpec.config;
				triggerObj.internalHandler = triggerSpec.handler.bind(this.pluginObj);
			}
			
			this.triggers[triggerName] = triggerObj;

			const triggerFunc = function (context, ...args) {
				return this.actions.trigger(this.name, triggerName, context || {}, ...args)
			}
			this.pluginObj.triggers[triggerName] = triggerFunc.bind(this.pluginObj);
		}
	}

	async updateSettings(newSettings, oldSettings)
	{
		let newPluginSettings = newSettings[this.name] || {};
		this.pluginObj.settings = newPluginSettings;
		if (this.onSettingsReload)
		{
			let oldPluginSettings = oldSettings[this.name] || {};
			if (!_.isEqual(newPluginSettings, oldPluginSettings))
			{
				this.onSettingsReload(newPluginSettings, oldPluginSettings);
			}
		}
	}

	async updateSecrets(newSecrets, oldSecrets)
	{
		let newPluginSecrets = newSecrets[this.name] || {};
		this.pluginObj.secrets = newPluginSecrets;
		if (this.onSecretsReload)
		{
			let oldPluginSecrets = oldSecrets[this.name] || {};
			if (!_.isEqual(newPluginSecrets, oldPluginSecrets))
			{
				this.onSettingsReload(newPluginSecrets, oldPluginSecrets);
			}
		}
	}

	getUIDescription()
	{
		let actions = {};

		const cleanStateSchemas = {};
		for (let stateName in this.stateSchemas)
		{
			cleanStateSchemas[stateName] = cleanSchemaForIPC(this.name + "_state_" + stateName, this.stateSchemas[stateName])
		}

		for (let actionKey in this.actions)
		{
			actions[actionKey] = {
				name: this.actions[actionKey].name,
				description: this.actions[actionKey].description,
				data: cleanSchemaForIPC(this.name + "_action_" + actionKey, this.actions[actionKey].data),
				color: this.actions[actionKey].color,
				icon: this.actions[actionKey].icon,
			}
		}

		let settings = {};

		//convert all types to strings
		for (let settingsKey in this.settings)
		{
			settings[settingsKey] = cleanSchemaForIPC(this.name + "_settings_" + settingsKey, this.settings[settingsKey]);
		}

		let secrets = {};

		//convert all types to strings
		for (let secretsKey in this.secrets)
		{
			secrets[secretsKey] = cleanSchemaForIPC(this.name + "_secrets_" + secretsKey, this.secrets[secretsKey]);
		}

		//triggers

		let triggers = {};

		for (let triggerName in this.triggers)
		{
			triggers[triggerName] = { ...this.triggers[triggerName] }

			if (triggers[triggerName].config)
			{
				triggers[triggerName].config = cleanSchemaForIPC(this.name + "_triggers_config_" + triggerName, triggers[triggerName].config);
			}

			const contextSchema = cleanSchemaForIPC(this.name + "_triggers_context_" + triggerName, {
				type: Object,
				properties: triggers[triggerName].context || {}
			});

			triggers[triggerName].context = contextSchema.properties;


			delete triggers[triggerName].internalHandler
			delete triggers[triggerName].handler
		}

		return {
			name: this.name,
			uiName: this.uiName,
			icon: this.icon,
			color: this.color,
			settings,
			secrets,
			triggers,
			actions,
			stateSchemas: cleanStateSchemas,
			ipcMethods: Object.keys(this.ipcMethods),
			...this.settingsView ? { settingsView: this.settingsView } : {}
		}
	}

	_bindFunction(config, name) {
		if (!config[name])
			return;

		this[name] = config[name].bind(this.pluginObj);
	}

	_bindAllFunctions(config, name, handler = () => {}) {
		const container = config[name];
		this[name] = {};
		for (let key in container) {
			const func = container[key].bind(this.pluginObj);
			this[name][key] = func;
			handler(key, func)
		}
	}

}
