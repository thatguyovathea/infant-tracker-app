"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

function AddBabyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const family_id = searchParams.get("family_id") ?? ""
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace("/login"); return }

    const authedClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${session.access_token}` } } }
    )

    const { error } = await authedClient
      .from("babies")
      .insert({
        name: formData.get("name") as string,
        family_id,
        date_of_birth: (formData.get("date_of_birth") as string) || null,
      })

    if (error) { setError(error.message); setLoading(false); return }

    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Add your baby</h1>
          <p className="text-muted-foreground text-sm">You can always add more babies later.</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Baby details</CardTitle>
              <CardDescription>Just the basics to get started.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Baby&apos;s name</Label>
                <Input id="name" name="name" placeholder="Emma" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">
                  Date of birth <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input id="date_of_birth" name="date_of_birth" type="date" />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Let's go"}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-muted-foreground"
                onClick={() => router.push("/dashboard")}>
                Skip for now
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

export default function AddBabyPage() {
  return (
    <Suspense>
      <AddBabyForm />
    </Suspense>
  )
}
