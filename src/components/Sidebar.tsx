import { usePrivy } from '@privy-io/react-auth'

const menuItems = [
  { id: 'overview', label: '總覽', icon: '📊' },
  { id: 'playground', label: 'API 測試場', icon: '🧪' },
  { id: 'billing', label: '帳單', icon: '💳' },
  { id: 'settings', label: '設定', icon: '⚙️' },
  { id: 'docs', label: '文件 ↗', icon: '📄', external: true },
  { id: 'mcp', label: '開物 MCP', icon: '🔌' },
]

interface SidebarProps {
  active: string
  onNavigate: (section: string) => void
  userEmail: string
}

export default function Sidebar({ active, onNavigate, userEmail }: SidebarProps) {
  const { logout } = usePrivy()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-surface border-r border-border flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <a href="/" className="text-accent font-extrabold text-xl no-underline hover:opacity-80 transition-opacity">
          開物 Kaiwu
        </a>
        <div className="text-muted text-xs mt-1">AI Search API</div>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-4">
        {menuItems.map((item) => {
          if (item.external) {
            return (
              <a
                key={item.id}
                href="https://github.com/dAAAb/Kaiwu-Dev"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-6 py-3 text-sm text-muted hover:text-white hover:bg-white/5 transition-colors no-underline"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </a>
            )
          }
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 text-sm transition-colors text-left ${
                isActive
                  ? 'text-accent bg-accent/10 border-r-2 border-accent'
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted truncate mb-2">{userEmail || '使用者'}</div>
        <button
          onClick={logout}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          登出
        </button>
      </div>
    </aside>
  )
}
