import { useEffect, useRef, useState } from 'react'
import { Bell, Building2, Check, ChevronDown, Menu, Pill, X } from 'lucide-react'

const NAV_ITEMS = ['Dashboard', 'Deviations']
const ACTIVE_ITEM = 'Deviations'

const COMPANIES = [
  'Kartik Pharmaceuticals Ltd.',
  'Vasudha Pharma Chem Limited',
  'Sunrise Biologics Pvt. Ltd.',
  'Meridian Labs International',
  'NovaCure Formulations Inc.',
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [company, setCompany] = useState(COMPANIES[0])
  const [companyOpen, setCompanyOpen] = useState(false)
  const companyRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (companyRef.current && !companyRef.current.contains(e.target)) {
        setCompanyOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-accent-fg"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-border-strong))' }}
          aria-hidden="true"
        >
          <Pill className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <div className="hidden leading-tight sm:block">
          <p className="text-xs font-bold tracking-tight text-fg">Deviation Intake</p>
          <p className="text-[9px] text-fg-subtle">AI-assisted deviation capture, review &amp; audit</p>
        </div>
      </div>

      <ul className="hidden items-center gap-1 lg:flex">
        {NAV_ITEMS.map((item) => {
          const isActive = item === ACTIVE_ITEM
          return (
            <li key={item}>
              <button
                type="button"
                className={
                  isActive
                    ? 'rounded-md bg-accent/15 px-2 py-1 text-[11px] font-medium text-accent'
                    : 'rounded-md px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg'
                }
              >
                {item}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="relative hidden md:block" ref={companyRef}>
          <button
            type="button"
            onClick={() => setCompanyOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={companyOpen}
            className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-fg-muted transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="max-w-[9rem] truncate">{company}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-fg-subtle" aria-hidden="true" />
          </button>

          {companyOpen && (
            <ul
              role="listbox"
              className="absolute right-0 top-full z-20 mt-1.5 w-56 rounded-md border border-border bg-surface py-1 shadow-lg shadow-border/50"
            >
              {COMPANIES.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={name === company}
                    onClick={() => {
                      setCompany(name)
                      setCompanyOpen(false)
                    }}
                    className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[11px] text-fg transition-colors hover:bg-surface-2"
                  >
                    <span className="truncate">{name}</span>
                    {name === company && <Check className="h-3 w-3 shrink-0 text-accent" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-full p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />
        </button>

        <button type="button" className="flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1 transition-colors hover:bg-surface-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fg text-[10px] font-semibold text-bg">
            MH
          </span>
          <ChevronDown className="hidden h-3 w-3 text-fg-subtle sm:block" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:hidden"
        >
          {mobileOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {mobileOpen && (
        <ul className="absolute inset-x-0 top-12 flex flex-col gap-1 border-b border-border bg-surface p-2 shadow-lg shadow-border/50 lg:hidden">
          {NAV_ITEMS.map((item) => {
            const isActive = item === ACTIVE_ITEM
            return (
              <li key={item}>
                <button
                  type="button"
                  className={
                    isActive
                      ? 'w-full rounded-md bg-accent/15 px-2.5 py-1.5 text-left text-xs font-medium text-accent'
                      : 'w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg'
                  }
                >
                  {item}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </nav>
  )
}
