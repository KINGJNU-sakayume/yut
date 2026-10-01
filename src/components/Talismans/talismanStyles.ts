import type { Rarity } from '../../data/talismans'

export const RARITY_STYLE: Record<Rarity, string> = {
  common: 'border-[#8a7360]',
  uncommon: 'border-[#2f6b46]',
  rare: 'border-[#2d4f86]',
  legendary: 'border-[#c99a3a] shadow-[0_0_12px_rgba(232,196,106,0.6)]',
  cursed: 'border-[#6e1510] shadow-[0_0_10px_rgba(168,38,28,0.6)]',
  blessing: 'border-[#7fd1c7]',
}

export const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-[#5a4636]',
  uncommon: 'text-[#2f6b46]',
  rare: 'text-[#2d4f86]',
  legendary: 'text-[#9a6d12]',
  cursed: 'text-[#a8261c]',
  blessing: 'text-[#2c7f75]',
}
