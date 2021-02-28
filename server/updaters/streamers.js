import fetch from 'node-fetch'
import { JsonRpc } from 'eosjs'
import HyperionSocketClient from '@eosrio/hyperion-stream-client'

//import config from '../../config'
import { Match, Settings, getSettings } from '../models'

export async function streamByNode(network, app, account, callback, actions) {
  console.info(`Start NODE updater for ${network.name} (${account})...`)

  // Здесь мы юзаем свой _skip так как в коде обработки экшена он думает что там будет хайпирион скип
  const rpc = new JsonRpc(`${network.protocol}://${network.host}:${network.port}`, { fetch })
  const settings = await getSettings(network)

  let offset = settings.actions_stream_offset[account] || 0

  // TODO короче тестить это все дерьмо с настройками
  console.log('start fetching actions by node from', offset, 'for', network.name, '(' + account + ')')
  while (true) {
    let r
    try {
      r = await rpc.history_get_actions(account, offset, 100)
    } catch (e) {
      console.log('getActionsByNode err: ', e.message)
      await new Promise((resolve, reject) => setTimeout(resolve, 2000))
      continue
    }

    for (const a of r.actions.map(a => a.action_trace)) {
      console.log('new action in streamer node', a.block_time)
      offset += 1

      if (actions.includes(a.act.name)) {
        await callback(a, network, app)

        console.log('offset', offset, network.name)
        settings.actions_stream_offset[account] = offset
        await Settings.updateOne({ chain: network.name }, { $set: { actions_stream_offset: settings.actions_stream_offset } })
      }
    }

    if (r.actions.length < 100) {
      await new Promise((resolve, reject) => setTimeout(resolve, 500))
    }
  }
}

export function streamHyperion(network, app, account, callback, actions) {
  throw new Error('Update by hyperion not implemented!')

  const client = new HyperionSocketClient(network.hyperion, { async: true, fetch })
  client.onConnect = async () => {
    const last_buy_match = await Match.findOne({ chain: network.name, type: 'buymatch' }, {}, { sort: { block_num: -1 } })
    const last_sell_match = await Match.findOne({ chain: network.name, type: 'sellmatch' }, {}, { sort: { block_num: -1 } })

    client.streamActions({
      contract: network.contract,
      action: 'sellmatch',
      account: network.contract,
      start_from: last_sell_match ? last_sell_match.block_num + 1 : 1,
      read_until: 0,
      filters: []
    })

    client.streamActions({
      contract: network.contract,
      action: 'buymatch',
      account: network.contract,
      start_from: last_buy_match ? last_buy_match.block_num + 1 : 1,
      read_until: 0,
      filters: []
    })

    // Other actions
    client.streamActions({ contract: network.contract, action: 'sellreceipt', account: network.contract })
    client.streamActions({ contract: network.contract, action: 'buyreceipt', account: network.contract })
    client.streamActions({ contract: network.contract, action: 'cancelsell', account: network.contract })
    client.streamActions({ contract: network.contract, action: 'cancelbuy', account: network.contract })
  }

  client.onData = async ({ content }, ack) => {
    await callback(content, network, app)
    ack()
  }

  client.connect(() => {
    console.log(`Start streaming for ${network.name}..`)
  })
}
