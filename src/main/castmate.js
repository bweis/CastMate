import { AutomationManager } from "./automations/automation-manager.js"
import { Analytics } from "./utils/analytics.js"
import logger from "./utils/logger.js"

import { ensureUserFolder, secretsFilePath, settingsFilePath } from "./utils/configuration.js";
import { ActionQueue } from "./actions/action-queue.js"
import { ProfileManager } from "./actions/profile-manager.js"
import { HotReloader } from './utils/hot-reloader.js'
import { createWebServices } from "./utils/webserver.js"
import { PluginManager } from "./utils/plugin-manager.js"
import _ from 'lodash'
import { ipcMain, app } from "./utils/electronBridge.js"

async function initInternal(mainWindowSender) {
	logger.info(`Starting CastMate v${app.getVersion()}`);

	ensureUserFolder();

	let plugins = new PluginManager();
	await plugins.load(mainWindowSender);

	const settings = new HotReloader(settingsFilePath,
		(newSettings, oldSettings) => {
			for (let plugin of plugins.plugins) {
				plugin.updateSettings(newSettings, oldSettings);
			}

			const newCastMateSettings = newSettings.castmate || {};
			const oldCastMateSettings = oldSettings.castmate || {};
			if (!_.isEqual(newCastMateSettings, oldCastMateSettings)) {
				//Recreating web services.
				logger.info("Restarting Internal Web Server")
				plugins.webServices.updatePort(newCastMateSettings.port || 80)
			}
		},
		(err) => {
			console.error("Error loading settings", err);
		});

	const secrets = new HotReloader(secretsFilePath,
		(newSecrets, oldSecrets) => {
			for (let plugin of plugins.plugins) {
				plugin.updateSecrets(newSecrets, oldSecrets);
			}
		},
		(err) => {
			console.error("Error loading secrets", err);
		});

	const automations = new AutomationManager();
	await automations.load();

	const actions = new ActionQueue(plugins, automations);

	const webServices = await createWebServices(settings.data.castmate || {}, secrets.data.castmate || {}, plugins);

	plugins.webServices = webServices;

	plugins.setupReactivity();

	const profiles = new ProfileManager(actions, plugins, mainWindowSender);

	//Let loose the web server
	webServices.start();

	const analytics = new Analytics(mainWindowSender);

	await plugins.init(settings, secrets, actions, profiles, webServices, analytics);

	await profiles.load();

	analytics.track("openApp");

	webServices.startWebsockets();
}


export async function initCastMate(mainWindowSender) {
	let initPromise = initInternal(mainWindowSender);

	ipcMain.handle('waitForInit', async () => {
		return await initPromise;
	})

	await initPromise;
}

