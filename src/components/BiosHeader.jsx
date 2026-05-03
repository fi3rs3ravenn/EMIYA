/**
 * BIOS-style верхний хедер.
 * Содержит: brand + версию системы + статус подключения + время + табы.
 *
 * Props:
 *   tabs:        [{ id, label }]
 *   activeTab:   string
 *   onTabChange: (id) => void
 *   connected:   bool
 *   sessionTime: string ("HH:MM:SS")
 *   uptime:      string (например "6.1m")
 */

export default function BiosHeader({
  tabs,
  activeTab,
  onTabChange,
  connected,
  sessionTime,
  uptime,
}) {
  return (
    <header className="bios-header">
      <div className="bios-header__top">
        <div className="bios-header__top-left">
          <span className="bios-header__brand">EMIYA</span>
          <span className="bios-header__meta">SYS_V2.0</span>
          <span className="bios-header__meta">PORT 7474</span>
        </div>

        <div className="bios-header__top-right">
          <span className="bios-header__status">
            <span className={`status-dot ${connected ? '' : 'offline'}`} />
            <span>{connected ? 'ONLINE' : 'OFFLINE'}</span>
          </span>
          {uptime && <span className="bios-header__meta">SESSION {uptime}</span>}
          <span className="bios-header__meta tnum">{sessionTime}</span>
        </div>
      </div>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${tab.id === activeTab ? 'tab--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
