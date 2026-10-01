import { PIECE_SKINS, YUT_SKINS } from '../data/unlocks'
import type { MetaSettings, MetaState } from '../game/meta'
import { Modal } from '../components/common/Modal'
import { T } from '../i18n/ko'

export function SettingsModal({ meta, onChange, onClose }: { meta: MetaState; onChange: (patch: Partial<MetaSettings>) => void; onClose: () => void }) {
  const s = meta.settings
  const pieceSkins = Object.keys(PIECE_SKINS).filter((k) => k === 'default' || meta.unlocked.includes(`pieceSkin:${k}`))
  const yutSkins = Object.keys(YUT_SKINS).filter((k) => k === 'default' || meta.unlocked.includes(`yutSkin:${k}`))
  return (
    <Modal title={T.settings.title} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.reducedMotion} onChange={(e) => onChange({ reducedMotion: e.target.checked })} className="h-5 w-5" />
          {T.settings.reducedMotion}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.showOdds} onChange={(e) => onChange({ showOdds: e.target.checked })} className="h-5 w-5" />
          {T.settings.showOdds}
        </label>
        <label className="flex items-center justify-between gap-2">
          {T.settings.pieceSkin}
          <select className="rounded border border-wood bg-white/60 px-2 py-1" value={s.pieceSkin} onChange={(e) => onChange({ pieceSkin: e.target.value })}>
            {pieceSkins.map((k) => (
              <option key={k} value={k}>
                {PIECE_SKINS[k].name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
          {T.settings.yutSkin}
          <select className="rounded border border-wood bg-white/60 px-2 py-1" value={s.yutSkin} onChange={(e) => onChange({ yutSkin: e.target.value })}>
            {yutSkins.map((k) => (
              <option key={k} value={k}>
                {YUT_SKINS[k].name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn w-full" onClick={onClose}>
          {T.settings.close}
        </button>
      </div>
    </Modal>
  )
}
