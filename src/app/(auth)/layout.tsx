
// src/app/(auth)/layout.tsx
export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-neutral-950">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/40 via-neutral-950 to-neutral-950" />
            <div className="absolute -top-20 -left-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-50 animate-pulse" />
            <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl opacity-50 animate-pulse delay-1000" />

            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

            <div className="relative w-full max-w-md p-4">
                {children}
            </div>
        </div>
    )
}
