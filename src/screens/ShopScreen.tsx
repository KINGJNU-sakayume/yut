import { useState } from 'react'
import { CONSUMABLE_MAP } from '../data/consumables'
import { getTrait } from '../data/pieceTraits'
import { getTalismanDef, talismanSellValue } from '../data/talismans'
import { getStickMod } from '../data/yutMods'
import { currentRerollCost } from '../game/shop'
import type { GameAction, RunState, ShopBuyParams } from '../game/types'
import { Modal } from '../components/common/Modal'
import { PiecePicker, StickPicker } from '../components/common/Pickers'
import { TalismanDetails } from '../components/Talismans/TalismanCard'
import { RARITY_STYLE } from '../components/Talismans/talismanStyles'
import { TalismanBar } from '../components/Talismans/TalismanBar'
import { ConsumableBar } from '../components/Side/ConsumableBar'
import { T } from '../i18n/ko'

export function ShopScreen({ run, dispatch }: { run: RunState; dispatch: (a: GameAction) => void }) {
  const shop = run.shop
  const [picking, setPicking] = useState(false)
  if (!shop) return null
  const rerollCost = currentRerollCost(run, shop)
  const special = shop.special
  const specialName = special ? (special.kind === 'stickMod' ? getStickMod(special.id)?.name : getTrait(special.id)?.name) : null
  const specialDesc = special ? (special.kind === 'stickMod' ? getStickMod(special.id)?.description : getTrait(special.id)?.description) : null
  const buySpecial = (params: ShopBuyParams) => {
    dispatch({ type: 'SHOP_BUY', section: 'special', index: 0, params })
    setPicking(false)
  }
  const full = run.talismans.length >= run.talismanCapacity

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-3xl font-black text-brass-light text-shadow-ink">🏮 {T.shop.title}</h2>
        <div className="flex items-center gap-2">
          <span className="font-serif text-xl font-black text-brass-light">🪙 {run.coins}</span>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'SHOP_REROLL' })} disabled={run.coins < rerollCost}>
            🔄 {rerollCost === 0 ? T.shop.rerollFree : `${T.shop.reroll} (${rerollCost})`}
          </button>
          <button type="button" className="btn btn-red" onClick={() => dispatch({ type: 'SHOP_LEAVE' })}>
            {T.shop.leave} →
          </button>
        </div>
      </div>

      <section>
        <h3 className="mb-2 font-serif text-lg font-black text-paper">{T.shop.talismans}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {shop.talismans.map((offer, i) => {
            const def = offer ? getTalismanDef(offer.defId) : null
            if (!offer || !def) {
              return (
                <div key={i} className="flex min-h-40 items-center justify-center rounded-lg border-2 border-dashed border-paper/20 text-paper/40">
                  {T.shop.sold}
                </div>
              )
            }
            return (
              <div key={i} className={`paper-panel flex flex-col gap-2 border-4 p-3 ${RARITY_STYLE[def.rarity]}`}>
                <div className="flex items-start gap-3">
                  <span className="talisman-paper flex h-16 w-12 shrink-0 items-center justify-center rounded border-2 font-serif text-3xl font-black">{def.glyph}</span>
                  <TalismanDetails def={def} />
                </div>
                {offer.synergy && <span className="chip self-start border-jade text-jade">✦ {T.shop.synergy}</span>}
                <button
                  type="button"
                  className="btn mt-auto"
                  disabled={run.coins < offer.price || full}
                  onClick={() => dispatch({ type: 'SHOP_BUY', section: 'talisman', index: i })}
                >
                  {full ? T.shop.full : `${T.shop.buy} — 🪙${offer.price}`}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <h3 className="mb-2 font-serif text-lg font-black text-paper">{T.shop.consumables}</h3>
          <div className="grid grid-cols-2 gap-3">
            {shop.consumables.map((offer, i) => {
              const def = offer ? CONSUMABLE_MAP[offer.id] : null
              if (!offer || !def) {
                return (
                  <div key={i} className="flex min-h-28 items-center justify-center rounded-lg border-2 border-dashed border-paper/20 text-paper/40">
                    {T.shop.sold}
                  </div>
                )
              }
              return (
                <div key={i} className="paper-panel flex flex-col gap-1 p-3">
                  <p className="font-serif font-black">
                    <span className="mr-1 text-xl text-jade">{def.glyph}</span>
                    {def.name}
                  </p>
                  <p className="text-xs">{def.description}</p>
                  <button
                    type="button"
                    className="btn mt-auto text-sm"
                    disabled={run.coins < offer.price || run.consumables.length >= run.consumableCapacity}
                    onClick={() => dispatch({ type: 'SHOP_BUY', section: 'consumable', index: i })}
                  >
                    {run.consumables.length >= run.consumableCapacity ? T.shop.full : `${T.shop.buy} — 🪙${offer.price}`}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
        <section>
          <h3 className="mb-2 font-serif text-lg font-black text-paper">{T.shop.special}</h3>
          {special ? (
            <div className="paper-panel flex flex-col gap-1 p-3">
              <p className="font-serif font-black">
                {special.kind === 'stickMod' ? '🎋 윷 개조' : '♟ 말 특성'}: {specialName}
              </p>
              <p className="text-sm">{specialDesc}</p>
              <button type="button" className="btn mt-1" disabled={run.coins < special.price} onClick={() => setPicking(true)}>
                {T.shop.buy} — 🪙{special.price}
              </button>
            </div>
          ) : (
            <div className="flex min-h-28 items-center justify-center rounded-lg border-2 border-dashed border-paper/20 text-paper/40">{T.shop.sold}</div>
          )}
        </section>
      </div>

      <section className="wood-panel flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <TalismanBar run={run} board={null} dispatch={dispatch} />
          <ConsumableBar run={run} board={null} dispatch={dispatch} />
        </div>
        {run.talismans.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {run.talismans.map((inst, i) => {
              const def = getTalismanDef(inst.defId)
              if (!def) return null
              return (
                <button key={inst.uid} type="button" className="btn btn-ghost text-xs" onClick={() => dispatch({ type: 'SHOP_SELL', index: i })}>
                  {T.shop.sell}: {def.name} (+🪙{talismanSellValue(def)})
                </button>
              )
            })}
          </div>
        )}
      </section>

      {picking && special && (
        <Modal title={`${specialName} — ${T.shop.buy}`} onClose={() => setPicking(false)}>
          {special.kind === 'stickMod' ? (
            <StickPicker sticks={run.sticks} mod={getStickMod(special.id)!} onPick={(stickIndex, twinOf) => buySpecial({ stickIndex, twinOf })} />
          ) : (
            <PiecePicker pieces={run.pieces} onPick={(pieceId) => buySpecial({ pieceId })} />
          )}
        </Modal>
      )}
    </div>
  )
}
