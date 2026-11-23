import type { GrowthCopyConfig } from '../core/growth-presentation';

/** 招式规划与当前可执行效果分别说明，避免卡面承诺未实现的变化。 */
export const growthCopyPrototype: GrowthCopyConfig = {
  statNames: { attackDamage: '攻击伤害', attackSpeed: '攻击频率', critChance: '暴击率', critDamageMultiplier: '暴击伤害倍率',
    pierceCount: '穿透数量', projectileSize: '弹体尺寸', range: '射程', areaSize: '范围', maxHealth: '最大生命', moveSpeed: '移动速度', damageReduction: '减伤比例', projectileCount: '弹体数量' },
  categoryNames: { general: '通用天赋', enchantment: '元素附魔', 'secondary-mechanism': '副机制' },
  routeDescriptions: { wanjian: '锁定万剑流，招式效果在第四阶段实现；可满足雷霆剑雨的路线前置。',
    thunder: '立即获得固有雷属性，不占附魔位；后续完整招式效果在第四阶段实现。',
    'returning-sword': '锁定回旋剑流，招式效果在第四阶段实现。' },
  branchDescriptions: { sanhua: '记录散华分支，招式效果在第四阶段实现。', jufeng: '记录聚锋分支，招式效果在第四阶段实现。',
    'chain-lightning': '记录连锁雷击分支，招式效果在第四阶段实现。', 'piercing-thunder': '记录雷霆贯心分支，招式效果在第四阶段实现。',
    'guarding-swords': '记录护体飞剑分支，招式效果在第四阶段实现。', 'seeking-swords': '记录追魂剑分支，招式效果在第四阶段实现。' },
  ultimateDescriptions: { wanjian: '已记录终极，招式效果在第四阶段实现。', thunder: '已记录终极，招式效果在第四阶段实现。', 'returning-sword': '已记录终极，招式效果在第四阶段实现。' },
};
