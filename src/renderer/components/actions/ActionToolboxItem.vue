<template>
<v-list-item
    style="cursor: grab; user-select: none;"
    :title="actionDefinition?.name"
    :subtitle="actionDefinition?.description"
    :color="actionDefinition?.color"
    lines="two"
    class="toolbox-item"
>
    <template #prepend>
        <v-avatar :color="actionDefinition?.color">
            <v-icon :icon="actionDefinition?.icon
            ? actionDefinition?.icon
            : 'mdi-file-document-outline'" />
        </v-avatar>
    </template>
</v-list-item>
</template>

<script>
import { mapGetters } from 'vuex';

export default {
    props: {
        pluginAction: {}
    },
    computed: {
        ...mapGetters("ipc", ["plugins"]),
        actionDefinition() {
            return this.plugins[this.pluginAction.plugin]?.actions?.[this.pluginAction.action];
        }
    }
}
</script>

<style scoped>
.toolbox-item.v-list-item {
    --indent-padding: 0px !important;
}
</style>