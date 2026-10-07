import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy notice", description: "What Lhyndahan collects when you order, why, and how long we keep it." };

const messenger = process.env.NEXT_PUBLIC_MESSENGER_URL;

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-8">
      <h1 className="font-display text-[34px] leading-tight">Privacy notice</h1>
      <p className="mt-1 text-[15px] text-muted">How Lhyndahan handles your information when you order.</p>

      <div className="mt-6 flex flex-col gap-6 text-[16px] leading-relaxed">
        <section>
          <h2 className="text-[18px] font-semibold">What we collect</h2>
          <p className="mt-1 text-muted">
            Your name, mobile number, what you ordered, and your notes. For &quot;My address&quot; delivery we also collect your address, landmark and, if you choose to share it, a map location. For KUS delivery we collect no address. We never ask for card or wallet numbers: if you pay by QR code, you pay in your own app and may send us a screenshot on Messenger.
          </p>
        </section>
        <section>
          <h2 className="text-[18px] font-semibold">Why we collect it</h2>
          <p className="mt-1 text-muted">Only to prepare your order, deliver it, confirm your payment, and contact you about your order. We don&apos;t sell your information or use it for ads.</p>
        </section>
        <section>
          <h2 className="text-[18px] font-semibold">Who can see it</h2>
          <p className="mt-1 text-muted">
            The shop owners and the people helping to deliver your order. Our database and hosting providers (Supabase and Vercel) store it on our behalf. The supplier only receives the product quantities, never your personal details.
          </p>
        </section>
        <section>
          <h2 className="text-[18px] font-semibold">This website</h2>
          <p className="mt-1 text-muted">
            We count visits with a random ID kept in your browser, with no cookies. To stop spam we keep a one-way scrambled code of your connection (not your IP address), which is deleted after 2 days. If you tick &quot;Remember my details on this phone&quot; at checkout, your details are saved only on your phone, and you can clear them by clearing your browser data.
          </p>
        </section>
        <section>
          <h2 className="text-[18px] font-semibold">How long we keep it</h2>
          <p className="mt-1 text-muted">
            About 6 months after your order, your name, number, address and notes are removed automatically. We only keep what you ordered and the total, for our sales records.
          </p>
        </section>
        <section>
          <h2 className="text-[18px] font-semibold">Your rights</h2>
          <p className="mt-1 text-muted">
            Under the Philippine Data Privacy Act you may ask to see, correct or delete your information, or object to how we use it. To do so, message us{messenger ? "" : " on the Messenger page where you found this shop"} and tell us your order number.{" "}
            {messenger ? (
              <a href={messenger} target="_blank" rel="noopener noreferrer" className="text-link underline">
                Message us on Messenger
              </a>
            ) : null}{" "}
            You may also file a complaint with the National Privacy Commission (privacy.gov.ph).
          </p>
        </section>
      </div>
    </main>
  );
}
