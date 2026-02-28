import lodash from 'lodash'
import { getTargetUid } from '../miao-plugin/apps/profile/ProfileCommon.js'
import ProfileDetail from '../miao-plugin/apps/profile/ProfileDetail.js'
import ProfileList from '../miao-plugin/apps/profile/ProfileList.js'
import ProfileChange from '../miao-plugin/apps/profile/ProfileChange.js'
import { profileArtis } from '../miao-plugin/apps/profile/ProfileArtis.js'
import { Data, Cfg, Meta  } from '../miao-plugin/components/index.js'
import { Weapon, Player, Character, ArtifactSet, Avatar } from '../miao-plugin/models/index.js'
let defWeapon = {
  bow: '西风猎弓',
  catalyst: '西风秘典',
  claymore: '西风大剑',
  polearm: '西风长枪',
  sword: '西风剑'
}
let req = async function (url, param = {}) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(`https://ark.ivny.top/${url}`, {
      method: param.method || 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: param.body,
      signal: controller.signal
    })
    clearTimeout(timeout)
    if (!response.ok) {
      return false
    }
    return await response.json()
  } catch (err) {
    return false
  }
}
ProfileChange.getProfile = (uid, charid, ds, game = 'gs') => {
  if (!charid) return false
  const isGs = game === 'gs'

  let player = Player.create(uid, game)

  let source = player.getProfile(charid)
  let dc = ds.char || {}
  if (!source || !source.hasData) source = {}

  let char = Character.get({ id: dc?.char || source.id || charid, elem: dc?.elem })
  if (!char) return false

  let level = dc.level || source.level || 90
  let promote = level === source.level ? source.promote : undefined

  let profiles = {}
  if (source && source.id) profiles[`${player.uid}:${source.id}`] = source
  // 获取source
  let getSource = function(cfg) {
    if (!cfg || !cfg.char) return source
    let cuid = cfg.uid || uid
    let id = cfg.char || source.id
    let key = `${cuid  }:${  id}`
    if (!profiles[key]) {
      let cPlayer = Player.create(cuid, game)
      profiles[key] = cPlayer.getProfile(id) || {}
    }
    return profiles[key]?.id ? profiles[key] : source
  }
  // 初始化profile
  let ret = new Avatar({
    uid,
    id: char.id,
    level,
    cons: Data.def(dc.cons, source.cons, 0),
    fetter: source.fetter || 10,
    elem: char.elem || source.char?.elem,
    dataSource: 'change',
    _source: 'change',
    promote,
    trees: lodash.extend([], Data.def(dc.trees, source.trees))
  }, char.game)
  // 设置武器
  let wCfg = ds.weapon || {}
  let wSource = getSource(wCfg).weapon || {}
  let weapon = Weapon.get(wCfg?.weapon || wSource?.name || defWeapon[char.weaponType], char.game, char.weaponType)
  if (char.isGs) {
    if (!weapon || weapon.type !== char.weaponType) weapon = Weapon.get(defWeapon[char.weaponType], char.game)
  }

  let wDs = {
    name: weapon.name,
    star: weapon.star,
    level: Math.min(weapon.maxLv || 90, wCfg.level || wSource.level || 90)
  }
  if (wSource.level === wDs.level) wDs.promote = wSource.promote
  wDs.affix = Math.min(weapon.maxAffix || 5, wCfg.affix || ((wDs.star === 5 && wSource.star !== 5) ? 1 : (wSource.affix || 5)))
  ret.setWeapon(wDs)

  // 设置天赋
  if (ds?.char?.talent) {
    ret.setTalent(ds?.char?.talent, 'level')
  } else {
    ret.setTalent(source?.originalTalent || (isGs ? { a: 9, e: 9, q: 9 } : { a: 6, e: 8, t: 8, q: 8 }), 'original')
  }

  // 设置圣遗物
  let artis = getSource(ds.artis)?.artis?.toJSON() || {}
  for (let idx = 1; idx <= (isGs ? 5 : 6); idx++) {
    if (ds[`arti${  idx}`]) {
      if (ds[`arti${  idx}`].mode === 'ocr') {
        delete ds[`arti${  idx}`].mode
        artis[idx] = ds[`arti${  idx}`]
      } else {
        let source = getSource(ds[`arti${  idx}`])
        if (source && source.artis && source.artis[idx]) artis[idx] = lodash.cloneDeep(source.artis[idx])
      }
    }
    let artisIdx = (isGs ? '00111' : '001122')[idx - 1]
    if (artis[idx] && ds.artisSet && ds.artisSet[artisIdx]) {
      let as = ArtifactSet.get(ds.artisSet[artisIdx], game)
      if (as) {
        artis[idx].id = as.getArti(idx)?.getIdByStar(artis[idx].star || 5)
        artis[idx].name = as.getArtiName(idx)
        artis[idx].set = as.name
      }
    }
  }
  ret.setArtis(artis)
  ret.calcAttr()
  return ret
}
let matchMsg = async (msg, imgUrls = []) => {
  if (!/(变|改|换)/.test(msg)) return false
  let game = /星铁/.test(msg) ? 'sr' : 'gs'
  msg = msg.toLowerCase().replace(/uid ?:? ?/, '').replace('星铁', '')
  let regRet = /^#*(\d{9,10})?(.+?)(详细|详情|面板|面版|圣遗物|伤害[1-7]?)?\s*(\d{9,10})?[变换改](.*)/.exec(msg)
  if (!imgUrls && (!regRet || !regRet[2])) return false
  let ret = {}
  let change = {}
  let char = Character.get(lodash.trim(regRet[2]).replace(/\d{9,10}/g, ''), game)
  game = char.isSr ? 'sr' : 'gs'
  if (!char) return false
  const isGs = game === 'gs'
  const keyMap = isGs
    ? {
      artis: '圣遗物',
      arti1: '花,生之花',
      arti2: '毛,羽,羽毛,死之羽',
      arti3: '沙,沙漏,表,时之沙',
      arti4: '杯,杯子,空之杯',
      arti5: '头,冠,理之冠,礼冠,帽子,帽',
      weapon: '武器'
    }
    : {
      artis: '圣遗物,遗器',
      arti1: '头,帽子,头部',
      arti2: '手,手套,手部',
      arti3: '衣,衣服,甲,躯干,',
      arti4: '鞋,靴,鞋子,靴子,脚,脚部',
      arti5: '球,位面球',
      arti6: '绳,线,链接绳,连接绳',
      weapon: '武器,光锥'
    }
  let keyTitleMap = {}
  lodash.forEach(keyMap, (val, key) => {
    lodash.forEach(val.split(','), (v) => {
      keyTitleMap[v] = key
    })
  })
  const keyReg = new RegExp(`^(\\d{9,10})?\\s*(.+?)\\s*(\\d{9,10})?\\s*((?:${lodash.keys(keyTitleMap).join('|')}|\\+)+)$`)

  ret.char = char.id
  ret.mode = regRet[3] === '换' ? '面板' : regRet[3]
  ret.uid = regRet[1] || regRet[4] || ''
  ret.game = game
  msg = regRet[5]
  if (imgUrls.length > 0) {
    const results = await Promise.all(imgUrls.map(async (imageUrl) => {
      try {
        return await req(`ocr/profilechange/${char.game}`, { body: JSON.stringify({ image: imageUrl }) })
      } catch (err) {
        return null
      }
    }))
    for (const res of results) {
      if (res) {
        change[res?.data?.type] = res?.data?.data
      }
    }
  }
  // 更换匹配
  msg = msg.replace(/[变改]/g, '换')
  lodash.forEach(msg.split('换'), (txt) => {
    txt = lodash.trim(txt)
    if (!txt) return true
    // 匹配圣遗物
    let keyRet = keyReg.exec(txt)
    if (keyRet && keyRet[4]) {
      let char = Character.get(lodash.trim(keyRet[2]), game)
      if (char) {
        lodash.forEach(keyRet[4].split('+'), (key) => {
          key = lodash.trim(key)
          let type = keyTitleMap[key]
          change[type] = {
            char: char.id || '',
            uid: keyRet[1] || keyRet[3] || '',
            type
          }
        })
      } else if (keyRet[4].length > 2) {
        return true
      }
    }

    // 匹配圣遗物套装
    let asMap = Meta.getAlias(game, 'artiSet')
    let asKey = asMap.sort((a, b) => b.length - a.length).join('|')
    let asReg = new RegExp(`^(${asKey})套?[2,4]?\\+?(${asKey})?套?[2,4]?\\+?(${asKey})?套?[2,4]?$`)
    let asRet = asReg.exec(txt)
    let getSet = (idx) => {
      let set = ArtifactSet.get(asRet[idx])
      return set ? set.name : false
    }
    if (asRet && asRet[1] && getSet(1)) {
      if (game === 'gs') {
        change.artisSet = [ getSet(1), getSet(2) || getSet(1) ]
      } else if (game === 'sr') {
        for (let idx = 1; idx <= 3; idx++) {
          let as = ArtifactSet.get(asRet[idx])
          if (as) { // 球&绳
            change.artisSet = change.artisSet || []
            let ca = change.artisSet
            ca[as.idxs?.[1] ? (ca[0] ? 1 : 0) : 2] = as.name
          }
        }
        let ca = change.artisSet
        if (ca && ca[0] && !ca[1]) ca[1] = ca[0]
      }
      return true
    }

    // 匹配武器
    let wRet = /^(?:等?级?([1-9][0-9])?级?)?\s*(?:([1-5一二三四五满])(精炼?|叠影?)|(精炼?|叠影?)([1-5一二三四五]))?\s*(?:等?级?([1-9][0-9])?级?)?\s*(.*)$/.exec(txt)
    if (wRet && wRet[7]) {
      let weaponName = lodash.trim(wRet[7])
      if (/专武/.test(weaponName)) {
        let char = Character.get(weaponName.replace('专武', '') || lodash.trim(regRet[2]).replace(/\d{9,10}/g, ''), ret.char.game)
        weaponName = `${char.name}专武`
      }
      let weapon = Weapon.get(weaponName, game, ret.char.game)
      if (weapon || weaponName === '武器' || Weapon.isWeaponSet(weaponName)) {
        let affix = wRet[2] || wRet[5]
        affix = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 满: 5 }[affix] || affix * 1
        let tmp = {
          weapon: (Weapon.isWeaponSet(weaponName) ? weaponName : weapon?.name) || '',
          affix: affix || '',
          level: wRet[1] * 1 || wRet[6] * 1 || ''
        }
        if (lodash.values(tmp).join('')) change.weapon = tmp
        return true
      }
    }
    let char = change.char || {}
    // 命座匹配
    let consRet = /([0-6零一二三四五六满])(命|魂|星魂)/.exec(txt)
    if (consRet && consRet[1]) {
      let cons = consRet[1]
      char.cons = Math.max(0, Math.min(6, lodash.isNaN(cons * 1) ? '零一二三四五六满'.split('').indexOf(cons) : cons * 1))
      txt = txt.replace(consRet[0], '')
    }

    // 行迹树匹配
    let treeRet = /满行迹/.exec(txt)
    if (!isGs && treeRet) {
      char.trees = [ '101', '102', '103', '201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '301', '302', '501' ]
      txt = txt.replace(treeRet[0], '')
    }

    // 天赋匹配
    // TODO 之后要适配 标记一下
    let talentRet = (isGs
      ? /(?:天赋|技能|行迹)((?:[1][0-5]|[1-9])[ ,]?)((?:[1][0-5]|[1-9])[ ,]?)([1][0-5]|[1-9])/
      : /(?:天赋|技能|行迹)((?:[1][0-5]|[1-9])[ ,]?)((?:[1][0-5]|[1-9])[ ,]?)((?:[1][0-5]|[1-9])[ ,]?)((?:[1][0-5]|[1-9])[ ,]?)((?:[1][0-5]|[1-9])[ ,]?)?([1][0-5]|[1-9])?/).exec(txt)
    if (talentRet) {
      char.talent = {}
      lodash.forEach((isGs ? 'a,e,q' : 'a,e,t,q,me,mt').split(','), (key, idx) => {
        char.talent[key] = talentRet[idx + 1] * 1 || 1
      })
      txt = txt.replace(talentRet[0], '')
    }

    let lvRet = /等级(?:^|[^0-9])(100|95|[1-9]|[1-8][0-9]|90)(?![0-9])|(?:^|[^0-9])(100|95|[1-9]|[1-8][0-9]|90)(?![0-9])级/.exec(txt)
    if (lvRet && (lvRet[1] || lvRet[2])) {
      char.level = (lvRet[1] || lvRet[2]) * 1
      txt = txt.replace(lvRet[0], '')
    }
    txt = lodash.trim(txt)
    if (txt) {
      if (char.isTraveler) txt = txt.replace(/元素/, '主')
      let chars = Character.get(txt, game)
      if (chars) {
        char.char = chars.id
        char.elem = chars.elem
      }
    }
    if (!lodash.isEmpty(char)) change.char = char
  })
  ret.change = lodash.isEmpty(change) ? false : change
  return ret
}
ProfileDetail.detail = async (e) => {
  let msg = e.original_msg || e.msg
  if (!msg) return false
  if (!/详细|详情|面板|面版|圣遗物|遗器|伤害|武器|换/.test(msg)) return false
  let imgUrls = []
  if (e.getReply) {
    let source = await e.getReply()
    if (source && source.message) {
      source.message.forEach(item => {
        if (item.type === 'image') imgUrls.push(item.url)
      })
    }
  } else if (e.source) {
    let source
    if (e.group?.getChatHistory) {
      source = (await e.group.getChatHistory(e.source?.seq, 1)).pop()
    } else if (e.friend?.getChatHistory) {
      source = (await e.friend.getChatHistory((e.source?.time + 1), 1)).pop()
    }
    if (source && source.message) {
      source.message.forEach(item => {
        if (item.type === 'image') imgUrls.push(item.url)
      })
    }
  }
  if (e.message) {
    e.message.forEach(item => {
      if (item.type === 'image') imgUrls.push(item.url)
    })
  }

  let mode = 'profile'
  let profileChange = false
  let changeMsg = msg
  let pc = await matchMsg(msg, imgUrls)

  if (pc && pc.char && pc.change) {
    if (!Cfg.get('profileChange')) return e.reply('面板替换功能已禁用...')
    e.game = pc.game
    e.isSr = e.game === 'sr'
    e.uid = ''
    e.msg = '#喵喵面板变换'
    e.uid = pc.uid || await getTargetUid(e)
    profileChange = ProfileChange.getProfile(e.uid, pc.char, pc.change, pc.game)
    if (profileChange && profileChange.char) {
      msg = `#${profileChange.char?.name}${pc.mode || '面板'}`
      e._profile = profileChange
      e._profileMsg = changeMsg
    }
  }
  let uidRet = /(18|[1-9])[0-9]{8}/g.exec(msg)
  if (uidRet) {
    e.uid = uidRet[0]
    msg = msg.replace(uidRet[0], '')
  }

  let name = msg.replace(/#|老婆|老公|星铁|原神/g, '').trim()
  msg = msg.replace('面版', '面板')
  let dmgRet = /(?:伤害|武器)(\d*)$/.exec(name)
  let dmgIdx = 0; let idxIsInput = false
  if (/(最强|最高|最高分|最牛|第一)/.test(msg)) {
    mode = /(分|圣遗物|遗器|评分|ACE)/.test(msg) ? 'rank-mark' : 'rank-dmg'
    name = name.replace(/(最强|最高分|第一|最高|最牛|圣遗物|遗器|评分|群)/g, '')
  }
  if (/(详情|详细|面板|面版)\s*$/.test(msg) && !/更新|录入|输入/.test(msg)) {
    mode = 'profile'
    name = name.replace(/(详情|详细|面板)/, '').trim()
  } else if (dmgRet) {
    // mode = /武器/.test(msg) ? 'weapon' : 'dmg'
    mode = 'dmg'
    name = name.replace(/(伤害|武器)+\d*/, '').trim()
    if (dmgRet[1]) {
      dmgIdx = dmgRet[1] * 1
      // 标识是用户指定的序号
      idxIsInput = true
    }
  } else if (/(详情|详细|面板)更新$/.test(msg) || (/更新/.test(msg) && /(详情|详细|面板)$/.test(msg))) {
    mode = 'refresh'
    name = name.replace(/详情|详细|面板|更新/g, '').trim()
  } else if (/圣遗物|遗器/.test(msg)) {
    mode = 'artis'
    name = name.replace(/圣遗物|遗器/, '').trim()
  }
  if (!Cfg.get('avatarProfile')) return false // 面板开关关闭
  let char = Character.get(name.trim(), e.game)
  if (!char) return false

  if (/星铁/.test(msg) || char.isSr) {
    e.game = 'sr'
    e.isSr = true
  }

  let uid = e.uid || await getTargetUid(e)
  if (!uid) return true

  e.uid = uid
  e.avatar = char.id
  if (char.isCustom) return e.reply('自定义角色暂不支持此功能')

  if (!char.isRelease) {
    // 预设面板支持未实装角色
    if (!profileChange && Number(e.uid) > 100000006) return e.reply('角色尚未实装')
    // 但仅在未实装开启时展示
    if (Cfg.get('notReleasedData') === false) return e.reply('未实装角色面板已禁用...')
  }

  if (mode === 'profile' || mode === 'dmg' || mode === 'weapon') {
    return ProfileDetail.render(e, char, mode, { dmgIdx, idxIsInput })
  } else if (mode === 'refresh') {
    await ProfileList.refresh(e)
    return true
  } else if (mode === 'artis') {
    return profileArtis(e)
  }
  return true

}

