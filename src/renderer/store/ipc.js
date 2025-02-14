
const { ipcRenderer } = require("electron");

const builtInPlugin = {
	name: 'castmate',
	uiName: 'CastMate',
	color: '#8DC1C0',
	icon: 'mdi-alpha-c-box',
	actions: {
		delay: {
			name: "Delay",
			color: '#8DC1C0',
			icon: "mdi-timer-sand",
			data: { type: "Number", required: true, unit: { name: "Seconds", short: "s" }, },
			description: "Puts a delay after the current action",
		},
		timestamp: {
			name: "Timestamp",
			color: '#8DC1C0',
			icon: "mdi-clock-outline",
			data: { type: "Number", required: true, unit: { name: "Seconds", short: "s" }, },
			description: "Delays execution of this action until a certain time after the start of this action list."
		},
		automation: {
			name: "Automation",
			color: '#8DC1C0',
			icon: "mdi-cog",
			data: {
				type: "Object",
				properties: {
					automation: { type: "Automation", required: true },
				},
			},
			description: "Runs another automation inside this one."
		},
	},
	settings: {
		port: { type: "Number", default: 80, name: "Internal Webserver Port" }
	},
	secrets: {},
	triggers: {},
	stateSchemas: {},
	ipcMethods: [],
}


export default {
	namespaced: true,
	state() {
		return {
			inited: false,
			plugins: [],
			client: null,
			paths: {},
			stateLookup: {},
			activeProfiles: [],
			analyticsId: null,
		}
	},
	getters: {
		paths: state => state.paths,
		activeProfiles: state => state.activeProfiles,
		plugins: state => ({ ...state.plugins, castmate: builtInPlugin }),
		pluginList: state => [...Object.keys(state.plugins).map(name => state.plugins[name]), builtInPlugin],
		inited: state => state.inited,
		stateLookup: state => state.stateLookup,
		analyticsId: state => state.analyticsId,
		stateSchemas: state => {
			const result = {};

			const pluginList = [...Object.keys(state.plugins).map(name => state.plugins[name]), builtInPlugin];
			for (let plugin of pluginList) {
				result[plugin.name] = plugin.stateSchemas;
			}

			return result;
		}
	},
	mutations: {
		setInited(state) {
			state.inited = true;
		},
		setPlugins(state, plugins) {
			state.plugins = plugins;
		},
		setPaths(state, paths) {
			state.paths = paths
		},
		setActiveProfiles(state, activeProfiles) {
			state.activeProfiles = activeProfiles;
		},
		setAnalyticsId(state, id) {
			state.analyticsId = id;
		},
		applyState(state, update) {
			for (let pluginKey in update) {
				if (!state.stateLookup[pluginKey]) {
					state.stateLookup[pluginKey] = {};
				}
				for (let stateKey in update[pluginKey]) {
					state.stateLookup[pluginKey][stateKey] = update[pluginKey][stateKey];
				}
			}
		},
		removeState(state, removal) {
			for (let pluginKey in removal) {
				if (!state.stateLookup[pluginKey])
					continue;

				delete state.stateLookup[pluginKey][removal[pluginKey]];

				if (Object.keys(state.stateLookup[pluginKey]) == 0) {
					delete state.stateLookup[pluginKey];
				}
			}
		}
	},
	actions: {
		async init({ commit }) {
			await ipcRenderer.invoke("waitForInit");
			commit('setInited');

			const plugins = await ipcRenderer.invoke('getPlugins');
			commit('setPlugins', plugins);

			const paths = await ipcRenderer.invoke('getPaths');
			commit('setPaths', paths);

			commit('applyState',  await ipcRenderer.invoke("getStateLookup"));

			commit('setActiveProfiles',  await ipcRenderer.invoke('core_getActiveProfiles'));
		},
		stateUpdate({ commit }, update) {
			//console.log("applyState", update);
			commit('applyState', update);
		},
		removeState({ commit }, varName) {
			commit('removeState', varName);
		},
		setActiveProfiles({ commit }, activeProfiles) {
			commit('setActiveProfiles', activeProfiles);
		},
		setAnalyticsId({ commit }, id) {
			commit('setAnalyticsId', id);
		},
	}
}