const { Rcon } = require('rcon-client');
const { template } = require('../utils/template');


module.exports = {
	name: "minecraft",
	async init()
	{
		this.startConnectLoop();
	},
	methods: {
		async tryConnect()
		{
			try
			{
				this.rcon = await Rcon.connect({
					host: this.settings.host,
					port: this.settings.port,
					password: this.secrets.password
				});

				this.rcon.on('end', () =>
				{
					this.startConnectLoop();
				})

				return true;
			}
			catch (err)
			{
				return false;
			}
		},

		async startConnectLoop()
		{
			this.rcon = null;

			if (!this.settings.host)
				return;
			if (!this.settings.port)
				return;
			if (!this.secrets.password)
				return;

			while (!(await this.tryConnect()));
		}
	},
	settings: {
		host: { type: String },
		port: { type: Number },
	},
	secrets: {
		password: { type: String }
	},
	actions: {
		mineCmd: {
			name: "Minecraft Command",
			data: {
				type: "TemplateString",
			},
			async handler(command, context)
			{
				if (!this.rcon)
				{
					return;
				}
				let fullCommand = template(command, context);
				console.log("MCRCON: ", fullCommand);
				let result = await this.rcon.send(fullCommand);
				console.log("MCRCON: ", result);
			}
		}
	}
}