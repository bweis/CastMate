<template>
  <v-row>
    <v-col>
      <v-card>
        <v-card-title> Phillip's HUE </v-card-title>
        <v-card-subtitle>
          Connect to HUE hub for light control
        </v-card-subtitle>
        <v-card-text>
          <span v-if="isConnected"> Already connected to HUE hub. </span>
          <span v-else>
            Push the button on your HUE Bridge, then you have about 30 seconds
            to click connect below
          </span>
        </v-card-text>
        <v-card-actions>
          <v-btn
            v-if="!isConnected"
            color="primary"
            :loading="connecting"
            @click="startSearchForHub"
          >
            Connect to HUE Hub
          </v-btn>
          <v-btn
            v-else
            color="secondary"
            :loading="connecting"
            @click="startSearchForHub"
          >
            Reconnect to HUE Hub
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-col>
  </v-row>
</template>

<script>
import { mapIpcs } from "../../utils/ipcMap";

export default {
  data() {
    return {
      connecting: false,
      isConnected: false,
    };
  },
  methods: {
    ...mapIpcs("hue", ["searchForHub", "getHubStatus"]),
    async startSearchForHub() {
      this.connecting = true;
      if (await this.searchForHub()) {
        this.isConnected = true;
      }
      this.connecting = false;
    },
  },
  async mounted() {
    this.isConnected = await this.getHubStatus();
  },
};
</script>

<style>
.hue-settings {
  display: flex;
  flex-direction: column;
  align-content: center;
}
</style>