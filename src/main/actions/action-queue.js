import { sleep } from "../utils/sleep.js"
import { Mutex } from "async-mutex"
import { reactiveCopy } from "../utils/reactive.js"
import logger from '../utils/logger.js'
import { ipcMain } from "../utils/electronBridge.js"
import _ from 'lodash'

export class ActionQueue {
	constructor(plugins, automations) {
		this.triggerMappings = {};
		this.triggerHandlers = {};

		this.automations = automations;

		//Queue of automations to run synchronously.
		this.queue = [];
		this.syncAutomationPromise = null;
		this.queueMutex = new Mutex();

		this.actions = {};

		for (let plugin of plugins.plugins) {
			this.actions[plugin.name] = {}
			for (let actionKey in plugin.actions) {
				this.actions[plugin.name][actionKey] = plugin.actions[actionKey];
			}

			this.triggerHandlers[plugin.name] = {};
			for (let triggerName in plugin.triggers) {

				const pluginTrigger = plugin.triggers[triggerName];
				this.triggerHandlers[plugin.name][triggerName] = async (context, ...args) => {

					if (!this.triggerMappings[plugin.name])
					{
						logger.error(`Error missing trigger handlers for  ${plugin.name}`);
						return;
					}

					const mappings = this.triggerMappings[plugin.name][triggerName];
					if (!mappings)
					{
						logger.error(`Error missing trigger handlers for  ${plugin.name}-${triggerName}`);
						return;
					}

					const completeContext = this.createCompleteContext(context)

					for (let mapping of mappings) {
						try {
							if (!pluginTrigger.internalHandler || await pluginTrigger.internalHandler(mapping.config, completeContext, mapping, ...args)) {
								this._startAutomationInternal(mapping.automation, completeContext)
							}
						}
						catch (err) {
							logger.error(`Error in trigger Handler ${plugin.name}:${triggerName} - ${err}`);
						}
					}
				}
			}
		}

		this.plugins = plugins;

		const dummyContext = {
			//Some dummy data.
			user: "LordTocs",
			userColor: "#4411FF",
			userId: "27082158",
			message: "Thanks for using CastMate.",
			filteredMessage: "Thanks for using CastMate.",
		}

		ipcMain.handle('core_runActions', async (event, actions, context) => {
			const automation = { actions, sync: false };

			const completeContext = this.createCompleteContext(context || dummyContext);

			this.pushToQueue(automation, completeContext)
		})

		ipcMain.handle('core_runAutomation', async (event, automationName, context) => {
			
			this.startAutomation(automationName, this.createCompleteContext(context || dummyContext))
		})
	}

	setTriggers(triggers) {
		this.triggerMappings = triggers;
	}

	convertOffsets(actions) {
		let timeSinceStart = 0;

		for (let a of actions) {
			if (a.plugin == 'castmate' && a.action == "timestamp") {
				a.beforeDelay = a.data - timeSinceStart;
				timeSinceStart = a.data;
			}
		}
	}

	async _startAutomationInternal(automationObj, context) {
		let automation = null;
		if (typeof automationObj == 'string' || automationObj instanceof String) {
			automation = this.automations.get(automationObj);

			if (!automation) {
				logger.error(`Missing Automation: ${automationName}`);
				return;
			}
		}
		else {
			automation = automationObj;
			//TODO: Validate automation object here.

			if (!automation) {
				logger.error(`Invalid automation object!`);
				return;
			}
		}

		this.pushToQueue(automation, context);
	}

	async startAutomation(automation, context) {
		return this._startAutomationInternal(automation, this.createCompleteContext(context))
	}

	async startAutomationArray(automations, context) {
		for (let automation of automations) {
			this.startAutomation(automation, context);
		}
	}

	_prepAutomation(automation) {
		if (!automation) {
			logger.error("Automation missing!");
		}

		if (!(automation.actions instanceof Array)) {
			logger.error("Automations must have an actions array.");
			return false;
		}

		if (automation.actions.length == 0) {
			logger.error("Automations shouldn't be empty.");
			return false;
		}

		automation.sync = !!automation.sync; //ensure that sync exists and is a bool.

		this.convertOffsets(automation.actions);
	}

	createCompleteContext(context) {
		let completeContext = { ...context };
		_.merge(completeContext, this.plugins.templateFunctions);
		//merge won't work with reactive props, manually go deep here.
		for (let pluginKey in this.plugins.stateLookup) {
			if (!(pluginKey in completeContext)) {
				completeContext[pluginKey] = {};
			}
			reactiveCopy(completeContext[pluginKey], this.plugins.stateLookup[pluginKey]);
		}
		return completeContext;
	}

	async pushToQueue(automation, context) {
		//Build our complete context.
		
		this._prepAutomation(automation);

		if (automation.sync) {
			//Push to the queue
			let release = await this.queueMutex.acquire();
			this.queue.push({ automation, context });
			release();

			this._runStartOfQueue();
		}
		else {
			this._runAutomation(automation, context);
		}
	}

	trigger(plugin, name, context, ...args) {
		const pluginHandlers = this.triggerHandlers[plugin];

		if (!pluginHandlers) {
			return false;
		}

		let triggerHandler = this.triggerHandlers[plugin][name];

		if (!triggerHandler) {
			return false;
		}

		return triggerHandler(context, ...args);
	}


	async _runAutomation(automation, context) {
		for (let action of automation.actions) {
			await this._runAction(action, context);
		}
	}


	async _runAction(action, context) {
		//Before delay is used by our offset calculations so it must stay.
		if (action.beforeDelay) {
			await sleep(action.beforeDelay * 1000);
		}

		const pluginActions = this.actions[action.plugin];
		if (pluginActions) {
			if (action.action in pluginActions) {
				pluginActions[action.action].handler(action.data, context).catch((reason) => {
					console.error(`${action.plugin}${action.action} threw Exception!`);
					console.error(reason);
				});
			}
		}

		if (action.plugin === "castmate") {
			if (action.action === "automation") {
				const subAutomationName = action.data.automation;
				const subAutomation = this.automations.get(subAutomationName);
				this._prepAutomation(subAutomation);
				await this._runAutomation(subAutomation);
			}

			if (action.action === "delay") {
				await sleep(action.data * 1000);
			}
		}
	}

	async _runNext() {
		if (this.queue.length > 0) {
			let release = await this.queueMutex.acquire();
			let frontAutomation = this.queue.shift();
			let frontPromise = this._runAutomation(frontAutomation.automation, frontAutomation.context);
			this.syncAutomationPromise = frontPromise;
			this.syncAutomationPromise.then(() => this._runNext());
			release();
		}
		else {
			this.syncAutomationPromise = null;
		}
	}

	async _runStartOfQueue() {
		if (this.syncAutomationPromise)
			return;

		if (this.queue.length == 0)
			return;

		logger.info("Starting new synchronous automation chain");
		let release = await this.queueMutex.acquire();
		let frontAutomation = this.queue.shift();
		let frontPromise = this._runAutomation(frontAutomation.automation, frontAutomation.context);
		this.syncAutomationPromise = frontPromise;
		this.syncAutomationPromise.then(() => this._runNext());
		release();
	}
}
