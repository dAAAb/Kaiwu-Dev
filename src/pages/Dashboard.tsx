import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import Sidebar from '../components/Sidebar'
import Overview from '../components/Overview'
import Playground from '../components/Playground'
import Billing from '../components/Billing'
import Settings from '../components/Settings'
import McpSection from '../components/McpSection'

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  type: string
  usage_count: number
  created_at: string
  revoked: number
  full_key?: string // only present on creation
}

export interface UserInfo {
  id: string
  email: string | null
  monthly_credits: number
  credits_used: number
}

export default function Dashboard() {
  const { authenticated, ready, login, getAccessToken, user } = usePrivy()
  const navigate = useNavigate()
  const { section } = useParams()
  const activeSection = section || 'overview'

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUserData = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) return

      // Auth callback - ensure user exists
      const authRes = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token }),
      })
      if (authRes.ok) {
        const data = await authRes.json()
        setUserInfo(data.user)
      }

      // Fetch API keys
      const keysRes = await fetch('/api/keys', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (keysRes.ok) {
        const data = await keysRes.json()
        setApiKeys(data.keys || [])
      }
    } catch (e) {
      console.error('Failed to fetch user data:', e)
    } finally {
      setLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => {
    if (ready && !authenticated) {
      login()
    }
    if (ready && authenticated) {
      fetchUserData()
    }
  }, [ready, authenticated, login, fetchUserData])

  const createApiKey = async (name: string) => {
    const token = await getAccessToken()
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const data = await res.json()
      // Refresh keys list and add the full key to show once
      await fetchUserData()
      return data.key as ApiKey & { full_key: string }
    }
    return null
  }

  const deleteApiKey = async (keyId: string) => {
    const token = await getAccessToken()
    await fetch('/api/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key_id: keyId }),
    })
    await fetchUserData()
  }

  if (!ready || (!authenticated && ready)) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-muted text-lg">載入中...</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-muted text-lg">載入儀表板...</div>
      </div>
    )
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'playground':
        return <Playground apiKeys={apiKeys} />
      case 'billing':
        return <Billing userInfo={userInfo} />
      case 'settings':
        return <Settings userInfo={userInfo} />
      case 'mcp':
        return <McpSection apiKeys={apiKeys} />
      default:
        return (
          <Overview
            userInfo={userInfo}
            apiKeys={apiKeys}
            onCreateKey={createApiKey}
            onDeleteKey={deleteApiKey}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-bg flex">
      <Sidebar
        active={activeSection}
        onNavigate={(s) => navigate(s === 'overview' ? '/dashboard' : `/dashboard/${s}`)}
        userEmail={user?.email?.address || userInfo?.email || ''}
      />
      <main className="flex-1 p-8 overflow-y-auto ml-64">
        {renderContent()}
      </main>
    </div>
  )
}
