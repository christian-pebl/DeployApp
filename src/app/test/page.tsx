'use client';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-3xl font-bold text-center">🎉 Success!</h1>
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <p className="text-center">
            <strong>Turbopack Error Fixed!</strong><br />
            Firebase has been removed and replaced with Vercel stack.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p><strong>✅ Removed:</strong> Firebase, Firestore, Firebase Auth</p>
          <p><strong>✅ Added:</strong> NextAuth.js, Prisma, Vercel Postgres</p>
          <p><strong>✅ Fixed:</strong> Leaflet imports and SSR issues</p>
        </div>
        <div className="text-center">
          <a href="/" className="text-blue-600 hover:underline">
            ← Back to Main App
          </a>
        </div>
      </div>
    </div>
  )
}