import Vue from 'vue'

import { asset } from 'eos-common'

Vue.mixin({
  computed: {
    isMobile() {
      return this.$store.state.isMobile
    }
  },

  methods: {
    inputToAsset(input, precision) {
      return asset((parseFloat(input) || 0).toFixed(precision) + ' XXX')
    },

    toFixed(value, precision) {
      return (parseFloat(value) || 0).toFixed(precision)
    },

    monitorTx(tx) {
      const network = this.$store.state.network
      return `${network.monitor}/transaction/${tx}?tab=traces&${network.monitor_params}`
    },

    monitorAccount(account) {
      return `${this.$store.state.network.monitor}/account/${account}?${this.$store.state.network.monitor_params}`
    },

    openInNewTab(url) {
      const win = window.open(url, '_blank')
      win.focus()
    }
  }
})
