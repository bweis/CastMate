<template>
  <v-dialog v-model="dialog" @keydown.esc="cancel">
    <v-card width="35vw">
      <v-toolbar dense flat>
        <v-toolbar-title class="text-body-2 font-weight-bold grey--text">
          {{ header }}
        </v-toolbar-title>
      </v-toolbar>
      <v-form @submit.prevent="create">
        <v-card-text>
          <v-text-field v-model="name" :label="label" ref="nameInput"/>
        </v-card-text>
        <v-card-actions class="pt-3">
          <v-spacer></v-spacer>
          <v-btn
            color="grey"
            text
            class="body-2 font-weight-bold"
            @click.native="cancel"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            class="body-2 font-weight-bold"
            outlined
            @click.native="create"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script>
import { nextTick } from 'vue';

export default {
  props: {
    header: { type: String, default: () => "Create" },
    label: { type: String, default: () => "Name" },
  },
  data() {
    return {
      name: null,
      dialog: false,
    };
  },
  mounted () {

  },  
  methods: {
    open() {
      this.name = null;
      this.dialog = true;
      nextTick(() => {
        this.$refs.nameInput.focus()
      })
    },
    cancel() {
      this.dialog = false;
    },
    async create() {
      if (!this.name) return;

      this.dialog = false;
      this.$emit("created", this.name);
    },
  },
};
</script>

<style>
</style>