'use client'

// EditProfileModal — shown only to the profile owner
// Handles: avatar upload (Supabase Storage), username change, bio edit

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

interface EditProfileModalProps {
  profile: Profile
  isOwner: boolean
}

export default function EditProfileModal({ profile, isOwner }: EditProfileModalProps) {
  const [open, setOpen] = useState(false)

  // Form state — initialized from current profile
  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)

  const [usernameError, setUsernameError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOwner) return null

  const initials = profile.username.slice(0, 2).toUpperCase()

  // ----- Avatar handlers -----

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.')
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setRemoveAvatar(false)
    setError('')
  }

  function handleRemoveAvatar() {
    setAvatarFile(null)
    setAvatarPreview(null)
    setRemoveAvatar(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ----- Username validation -----

  function validateUsername(val: string) {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(val)) {
      setUsernameError('3–20 chars: letters, numbers, underscores only.')
    } else {
      setUsernameError('')
    }
  }

  // ----- Save -----

  async function handleSave() {
    if (usernameError) return
    setSaving(true)
    setError('')

    try {
      let finalAvatarUrl: string | null = profile.avatar_url

      // Upload new avatar directly to Supabase Storage
      if (avatarFile) {
        const supabase = createClient()
        const ext = avatarFile.name.split('.').pop() ?? 'jpg'
        // Unique path per upload — avoids CDN cache issues
        const path = `${profile.id}/avatar-${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: false })

        if (uploadError) throw new Error('Avatar upload failed: ' + uploadError.message)

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(path)

        finalAvatarUrl = publicUrl
      } else if (removeAvatar) {
        finalAvatarUrl = null
      }

      // Patch profile
      const payload: Record<string, unknown> = {
        bio,
        avatar_url: finalAvatarUrl,
      }
      // Only send username if it changed
      if (username !== profile.username) {
        payload.username = username
      }

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save profile.')

      // Redirect if username changed, otherwise reload
      if (username !== profile.username) {
        window.location.href = `/profile/${username}`
      } else {
        window.location.reload()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  // ----- Reset on close -----

  function handleClose() {
    setOpen(false)
    setUsername(profile.username)
    setBio(profile.bio ?? '')
    setAvatarPreview(profile.avatar_url)
    setAvatarFile(null)
    setRemoveAvatar(false)
    setUsernameError('')
    setError('')
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-border text-[12px] font-mono text-muted hover:text-text-dim hover:border-border-hl transition-colors"
      >
        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Edit profile
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-surface border border-border-hl rounded-[16px] w-full max-w-[420px] p-8 shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between mb-7">
              <h2 className="font-mono text-[18px] font-bold text-text">Edit Profile</h2>
              <button
                onClick={handleClose}
                className="text-muted hover:text-text-dim transition-colors"
                aria-label="Close"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Avatar */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-3">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile photo"
                    className="w-[88px] h-[88px] rounded-full object-cover border-2 border-border-hl"
                  />
                ) : (
                  <div className="w-[88px] h-[88px] rounded-full bg-surface-2 border-2 border-border-hl flex items-center justify-center font-mono text-[28px] font-bold text-accent select-none">
                    {initials}
                  </div>
                )}
                {/* Camera button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-[28px] h-[28px] rounded-full bg-accent text-[#0a0a0a] flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
                  title="Change photo"
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>

              {/* Photo actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[12px] font-mono text-accent hover:opacity-80 transition-opacity"
                >
                  Change photo
                </button>
                {(avatarPreview || profile.avatar_url) && (
                  <>
                    <span className="text-muted text-[12px]">·</span>
                    <button
                      onClick={handleRemoveAvatar}
                      className="text-[12px] font-mono text-muted hover:text-hot transition-colors"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
              <p className="mt-2 text-[11px] text-muted font-mono">JPG, PNG, WebP or GIF · max 5 MB</p>
            </div>

            {/* Username */}
            <div className="mb-5">
              <label className="block font-mono text-[11px] uppercase tracking-[0.1em] text-muted mb-2">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[14px] text-muted pointer-events-none">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); validateUsername(e.target.value) }}
                  className="w-full bg-bg border border-border rounded-[8px] pl-8 pr-4 py-2.5 font-mono text-[14px] text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
                  placeholder="yourhandle"
                  maxLength={20}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
              {usernameError ? (
                <p className="mt-1.5 text-[11px] text-hot font-mono">{usernameError}</p>
              ) : username !== profile.username ? (
                <p className="mt-1.5 text-[11px] text-muted font-mono">
                  Your profile URL will change to /profile/{username}
                </p>
              ) : null}
            </div>

            {/* Bio */}
            <div className="mb-6">
              <label className="block font-mono text-[11px] uppercase tracking-[0.1em] text-muted mb-2">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-bg border border-border rounded-[8px] px-4 py-2.5 text-[14px] text-text placeholder-muted focus:outline-none focus:border-accent transition-colors resize-none"
                placeholder="Short seller. Always bearish. Never wrong (until I am)."
                rows={3}
                maxLength={200}
              />
              <div className="flex justify-end mt-1">
                <span className={`font-mono text-[11px] ${bio.length >= 180 ? 'text-swayze' : 'text-muted'}`}>
                  {bio.length}/200
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="mb-4 text-[12px] text-hot font-mono">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleClose}
                className="px-5 py-2.5 rounded-[8px] border border-border text-[13px] font-mono text-muted hover:text-text-dim hover:border-border-hl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !!usernameError}
                className="px-5 py-2.5 rounded-[8px] bg-accent text-[#0a0a0a] text-[13px] font-mono font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
