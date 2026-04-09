export default function CommunityPage() {
  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold text-navy mb-2">Społeczność</h2>
      <p className="text-gray-500 mb-8">Dyskusje, pytania i wskazówki od uczestników warsztatów</p>

      {/* New post */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold font-semibold">
            ?
          </div>
          <input
            type="text"
            placeholder="Podziel się czymś ze społecznością..."
            className="flex-1 bg-slate-light rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all"
          />
        </div>
      </div>

      {/* Empty state */}
      <div className="bg-card rounded-xl border border-border p-12 text-center shadow-sm">
        <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
          </svg>
        </div>
        <h3 className="font-heading text-lg font-semibold text-navy mb-2">Brak postów</h3>
        <p className="text-gray-500 text-sm">Bądź pierwszą osobą, która podzieli się czymś ze społecznością</p>
      </div>
    </div>
  );
}
