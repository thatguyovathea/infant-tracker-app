"use client"

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 30, 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">What We Collect</h2>
            <p>
              Care Tracking collects the following information to provide core app functionality:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Email address (for account creation and login)</li>
              <li>Display name (optional, shown to family members)</li>
              <li>Baby profiles (name, date of birth, notes)</li>
              <li>Activity logs (feeding, sleep, and diaper change records)</li>
              <li>Device tokens (for push notification delivery on iOS)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">How We Store Your Data</h2>
            <p>
              All data is stored in a Supabase-hosted PostgreSQL database. Data is encrypted in
              transit via TLS. Your data is associated with your account and accessible only to
              you and members of your family group.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Family Sharing</h2>
            <p>
              When you create or join a family group, all members of that group can view and log
              activity for shared baby profiles. Family groups are private and require an invite
              code to join.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Camera Usage</h2>
            <p>
              The app uses your device camera solely for barcode scanning to look up food products.
              No images are captured, stored, or transmitted. Camera access is requested only when
              you initiate a barcode scan.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Push Notifications</h2>
            <p>
              If you enable push notifications, your iOS device token is stored to deliver
              notifications when family members log activities. You can disable notifications
              at any time in your device settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Third Parties</h2>
            <p>
              Care Tracking does not use third-party analytics, advertising, or tracking services.
              Barcode lookups query the Open Food Facts and UPC Item DB public APIs — only the
              barcode number is sent, no personal information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Data Sales</h2>
            <p>We do not sell, rent, or share your personal data with any third party.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Data Deletion</h2>
            <p>
              You can delete your account and all associated data at any time by contacting us.
              Upon deletion, all your personal information, baby profiles, and activity logs are
              permanently removed from our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Contact</h2>
            <p>
              For privacy questions or data deletion requests, contact us at:{" "}
              <a href="mailto:privacy@caretracking.app" className="text-primary underline">
                privacy@caretracking.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
