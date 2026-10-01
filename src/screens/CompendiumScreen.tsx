import { useState } from 'react'
import { ACHIEVEMENTS } from '../data/achievements'
import { BOSSES } from '../data/bosses'
import { EVENTS } from '../data/events'
import { RARITY_LABELS, TALISMANS } from '../data/talismans'
import { UNLOCKS } from '../data/unlocks'
import { canBuyUnlock, type MetaState } from '../game/meta'
import { TalismanDetails } from '../components/Talismans/TalismanCard'
import { T, formatNumber } from '../i18n/ko'

type Tab = 'talismans' | 'bosses' | 'events' | 'unlocks' | 'achievements' | 'records'

export function CompendiumScreen({ meta, onBack, onBuy }: { meta: MetaState; onBack: () => void; onBuy: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>('talismans')
  const tabs: [Tab, string][] = [
    ['talismans', T.compendium.talismans],
    ['bosses', T.compendium.bosses],
    ['events', T.compendium.events],
    ['unlocks', T.compendium.unlocks],
    ['achievements', T.compendium.achievements],
    ['records', T.compendium.records],
  ]
  const known = new Set(meta.discovered.talismans)
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-3xl font-black text-brass-light text-shadow-ink">📜 {T.compendium.title}</h2>
        <span className="font-serif text-xl font-black text-[#ff9c8c]">🔥 {T.title.dokkaebibul} {meta.dokkaebibul}</span>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← {T.compendium.back}
        </button>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`btn ${tab === id ? '' : 'btn-ghost'} text-sm`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'talismans' && (
        <>
          <p className="text-sm text-paper/70">
            발견 {TALISMANS.filter((t) => known.has(t.id)).length} / {TALISMANS.length}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TALISMANS.map((t) =>
              known.has(t.id) ? (
                <div key={t.id} className="paper-panel flex gap-2 p-3">
                  <span className="talisman-paper flex h-14 w-11 shrink-0 items-center justify-center rounded border-2 font-serif text-2xl font-black">{t.glyph}</span>
                  <TalismanDetails def={t} />
                </div>
              ) : (
                <div key={t.id} className="paper-panel flex items-center gap-2 p-3 opacity-60">
                  <span className="flex h-14 w-11 items-center justify-center rounded border-2 border-dashed border-ink/40 font-serif text-2xl">?</span>
                  <div className="text-sm">
                    <p className="font-bold">{T.compendium.unknown}</p>
                    <p className="text-xs">
                      {RARITY_LABELS[t.rarity]}
                      {t.unlock && !meta.unlocked.includes(t.unlock) ? ' · 해금 필요' : ''}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </>
      )}

      {tab === 'bosses' && (
        <div className="grid gap-3 md:grid-cols-2">
          {BOSSES.map((b) =>
            meta.discovered.bosses.includes(b.id) ? (
              <div key={b.id} className="paper-panel p-3">
                <p className="font-serif text-lg font-black text-goblin">
                  {b.glyph} {b.name}
                </p>
                <p className="text-sm font-bold">{b.rule}</p>
                <p className="text-xs text-ink-soft">{b.detail}</p>
              </div>
            ) : (
              <div key={b.id} className="paper-panel p-3 opacity-60">
                <p className="font-serif font-black">??? {b.unlock && !meta.unlocked.includes(b.unlock) ? '(해금 필요)' : ''}</p>
              </div>
            ),
          )}
        </div>
      )}

      {tab === 'events' && (
        <div className="grid gap-3 md:grid-cols-2">
          {EVENTS.map((e) =>
            meta.discovered.events.includes(e.id) ? (
              <div key={e.id} className="paper-panel p-3">
                <p className="font-serif text-lg font-black">
                  {e.glyph} {e.name}
                </p>
                <p className="text-sm">{e.description}</p>
              </div>
            ) : (
              <div key={e.id} className="paper-panel p-3 opacity-60">
                <p className="font-serif font-black">??? {e.unlock && !meta.unlocked.includes(e.unlock) ? '(해금 필요)' : ''}</p>
              </div>
            ),
          )}
        </div>
      )}

      {tab === 'unlocks' && (
        <div className="grid gap-3 md:grid-cols-2">
          {UNLOCKS.map((u) => {
            const owned = meta.unlocked.includes(u.id)
            const blocked = Boolean(u.requires && !meta.unlocked.includes(u.requires))
            return (
              <div key={u.id} className={`paper-panel flex items-center justify-between gap-2 p-3 ${owned ? 'opacity-70' : ''}`}>
                <div>
                  <p className="font-serif font-black">{u.name}</p>
                  <p className="text-xs">{u.description}</p>
                </div>
                {owned ? (
                  <span className="chip border-jade text-jade">{T.compendium.owned}</span>
                ) : (
                  <button type="button" className="btn shrink-0 text-sm" disabled={!canBuyUnlock(meta, u.id)} onClick={() => onBuy(u.id)} title={blocked ? T.compendium.requires : undefined}>
                    🔥{u.cost} {blocked ? `(${T.compendium.requires})` : T.compendium.buy}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'achievements' && (
        <div className="grid gap-3 md:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const done = meta.achievements.includes(a.id)
            return (
              <div key={a.id} className={`paper-panel p-3 ${done ? '' : 'opacity-60'}`}>
                <p className="font-serif font-black">
                  {done ? '🏮' : '⬜'} {a.name}
                </p>
                <p className="text-xs">{a.description}</p>
                <p className="text-xs font-bold text-goblin">🔥 +{a.reward}</p>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'records' && (
        <div className="paper-panel p-3 text-sm">
          <p>
            판 {meta.stats.runs} · 승 {meta.stats.wins} · 패 {meta.stats.losses} · 최고 마당 {meta.stats.bestYard > 8 ? '완주' : meta.stats.bestYard} · 최고 총점{' '}
            {formatNumber(meta.stats.highestScore)} · 최고 퇴근 {formatNumber(meta.stats.bestCashOut)} · 잡은 도깨비 {meta.stats.captures}
          </p>
          <table className="mt-2 w-full text-left text-xs">
            <thead>
              <tr>
                <th>씨앗</th>
                <th>결과</th>
                <th>마당</th>
                <th>총점</th>
                <th>빚</th>
              </tr>
            </thead>
            <tbody>
              {meta.seeds.map((s, i) => (
                <tr key={i}>
                  <td className="font-mono">{s.seed}</td>
                  <td>{s.result === 'win' ? '승' : s.result === 'loss' ? '패' : '포기'}</td>
                  <td>{s.yard}</td>
                  <td>{formatNumber(s.score)}</td>
                  <td>{s.debtLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
