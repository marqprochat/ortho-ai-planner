export default function DentalConnectIcon({ className = 'w-8 h-8' }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="dc-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
                <linearGradient id="dc-tooth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="100%" stopColor="#e0f2f1" stopOpacity="0.92" />
                </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="url(#dc-bg)" />
            <path
                d="M32 9 C25.5 9 18 13.5 16.5 22 C15.2 29.5 17 37 19 43.5 C20.5 49 22.5 53.5 25.5 50.5 C27.5 48 29.5 46.5 32 46.5 C34.5 46.5 36.5 48 38.5 50.5 C41.5 53.5 43.5 49 45 43.5 C47 37 48.8 29.5 47.5 22 C46 13.5 38.5 9 32 9Z"
                fill="url(#dc-tooth)"
            />
            <line x1="32" y1="18" x2="32" y2="30" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
            <circle cx="46" cy="15" r="2" fill="white" opacity="0.9" />
            <path d="M49 10 A7 7 0 0 1 56 17" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.5" />
            <path d="M51 7  A11 11 0 0 1 59 21" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.25" />
        </svg>
    );
}
