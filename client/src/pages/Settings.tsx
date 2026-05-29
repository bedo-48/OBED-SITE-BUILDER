import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CoinsIcon, Loader2Icon, LogOutIcon, Trash2Icon } from 'lucide-react'
import api from '../lib/api'
import { authClient } from '../lib/auth-client'
import Footer from '../components/Footer'

interface Profile {
    id: string
    name: string
    email: string
    credits: number
    totalCreation: number
}

const Settings = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: session, isPending } = authClient.useSession()

    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    const [name, setName] = useState('')
    const [savingName, setSavingName] = useState(false)

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [changingPassword, setChangingPassword] = useState(false)

    const fetchProfile = async () => {
        try {
            const { data } = await api.get('/api/user/me')
            setProfile(data.user)
            setName(data.user?.name || '')
        } catch (error: any) {
            toast.error(error?.response?.data?.message || error.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isPending) return
        if (!session) {
            navigate('/auth/sign-in')
            return
        }
        fetchProfile()
    }, [session, isPending])

    // Handle return from Stripe Checkout
    useEffect(() => {
        if (searchParams.get('payment') === 'success') {
            toast.success('Payment successful! Your credits will appear shortly.')
            searchParams.delete('payment')
            setSearchParams(searchParams, { replace: true })
            // Credits are granted by the webhook; refetch after a short delay
            const t = setTimeout(fetchProfile, 3000)
            return () => clearTimeout(t)
        }
    }, [searchParams])

    const saveName = async (e: FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return
        try {
            setSavingName(true)
            const { data } = await api.post('/api/user/update-profile', { name })
            setProfile((prev) => (prev ? { ...prev, name: data.user.name } : prev))
            toast.success('Profile updated')
        } catch (error: any) {
            toast.error(error?.response?.data?.message || error.message)
        } finally {
            setSavingName(false)
        }
    }

    const changePassword = async (e: FormEvent) => {
        e.preventDefault()
        if (!currentPassword || !newPassword) return
        if (newPassword.length < 8) {
            return toast.error('New password must be at least 8 characters')
        }
        try {
            setChangingPassword(true)
            const { error } = await authClient.changePassword({
                currentPassword,
                newPassword,
                revokeOtherSessions: true,
            })
            if (error) throw new Error(error.message)
            setCurrentPassword('')
            setNewPassword('')
            toast.success('Password changed')
        } catch (error: any) {
            toast.error(error?.message || 'Could not change password')
        } finally {
            setChangingPassword(false)
        }
    }

    const handleSignOut = async () => {
        await authClient.signOut()
        navigate('/')
    }

    const handleDeleteAccount = async () => {
        if (!window.confirm('Delete your account and all your projects? This cannot be undone.')) {
            return
        }
        try {
            await api.delete('/api/user/account')
            await authClient.signOut()
            toast.success('Account deleted')
            navigate('/')
        } catch (error: any) {
            toast.error(error?.response?.data?.message || error.message)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <Loader2Icon className="size-7 animate-spin text-indigo-200" />
            </div>
        )
    }

    return (
        <>
            <div className="max-w-3xl mx-auto px-4 py-10 min-h-[80vh] text-white">
                <h1 className="text-2xl font-medium mb-8">Settings</h1>

                {/* Profile */}
                <section className="bg-gray-900/60 border border-gray-700 rounded-lg p-6 mb-6">
                    <h2 className="text-lg font-medium mb-4">Profile</h2>
                    <form onSubmit={saveName} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full p-2.5 rounded-md bg-gray-800 border border-gray-700 outline-none focus:ring-2 ring-indigo-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                            <input
                                type="email"
                                value={profile?.email || ''}
                                disabled
                                className="w-full p-2.5 rounded-md bg-gray-800/60 border border-gray-700 text-gray-400 text-sm cursor-not-allowed"
                            />
                        </div>
                        <button
                            disabled={savingName || name.trim() === (profile?.name || '')}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-4 py-2 rounded-md text-sm transition-colors"
                        >
                            {savingName && <Loader2Icon className="size-4 animate-spin" />} Save changes
                        </button>
                    </form>
                </section>

                {/* Credits & usage */}
                <section className="bg-gray-900/60 border border-gray-700 rounded-lg p-6 mb-6">
                    <h2 className="text-lg font-medium mb-4">Credits &amp; usage</h2>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-40 bg-gray-800 rounded-md p-4">
                            <div className="flex items-center gap-2 text-gray-400 text-xs">
                                <CoinsIcon size={14} className="text-yellow-400" /> Credits
                            </div>
                            <p className="text-2xl font-semibold mt-1">{profile?.credits ?? 0}</p>
                        </div>
                        <div className="flex-1 min-w-40 bg-gray-800 rounded-md p-4">
                            <div className="text-gray-400 text-xs">Projects created</div>
                            <p className="text-2xl font-semibold mt-1">{profile?.totalCreation ?? 0}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/pricing')}
                        className="mt-4 bg-white/10 hover:bg-white/15 px-4 py-2 rounded-md text-sm transition-colors"
                    >
                        Buy more credits
                    </button>
                </section>

                {/* Security */}
                <section className="bg-gray-900/60 border border-gray-700 rounded-lg p-6 mb-6">
                    <h2 className="text-lg font-medium mb-4">Change password</h2>
                    <form onSubmit={changePassword} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Current password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full p-2.5 rounded-md bg-gray-800 border border-gray-700 outline-none focus:ring-2 ring-indigo-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">New password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full p-2.5 rounded-md bg-gray-800 border border-gray-700 outline-none focus:ring-2 ring-indigo-500 text-sm"
                            />
                        </div>
                        <button
                            disabled={changingPassword || !currentPassword || !newPassword}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-4 py-2 rounded-md text-sm transition-colors"
                        >
                            {changingPassword && <Loader2Icon className="size-4 animate-spin" />} Update password
                        </button>
                    </form>
                </section>

                {/* Account */}
                <section className="bg-gray-900/60 border border-red-900/50 rounded-lg p-6">
                    <h2 className="text-lg font-medium mb-4">Account</h2>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md text-sm transition-colors"
                        >
                            <LogOutIcon size={16} /> Sign out
                        </button>
                        <button
                            onClick={handleDeleteAccount}
                            className="flex items-center gap-2 bg-red-600/90 hover:bg-red-600 px-4 py-2 rounded-md text-sm transition-colors"
                        >
                            <Trash2Icon size={16} /> Delete account
                        </button>
                    </div>
                </section>
            </div>
            <Footer />
        </>
    )
}

export default Settings
