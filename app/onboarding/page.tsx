"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function OnboardingPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const name = (new FormData(e.currentTarget)).get("name") as string
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) { router.replace("/login"); return }

    const { data: family, error: familyError } = await client
      .from("families")
      .insert({ name, created_by: session.user.id })
      .select()
      .single()

    if (familyError) { setError(familyError.message); setLoading(false); return }

    const { error: memberError } = await client
      .from("family_members")
      .insert({ family_id: family.id, user_id: session.user.id, role: "admin" })

    if (memberError) { setError(memberError.message); setLoading(false); return }

    router.push(`/onboarding/baby?family_id=${family.id}`)
  }

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const invite_code = ((new FormData(e.currentTarget)).get("invite_code") as string).trim().toLowerCase()
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) { router.replace("/login"); return }

    const { data: family, error: findError } = await client
      .from("families")
      .select("id")
      .eq("invite_code", invite_code)
      .single()

    if (findError || !family) {
      setError("Invalid invite code. Please check and try again.")
      setLoading(false)
      return
    }

    const { error: memberError } = await client
      .from("family_members")
      .insert({ family_id: family.id, user_id: session.user.id, role: "member" })

    if (memberError) {
      setError(memberError.code === "23505" ? "You are already a member of this family." : memberError.message)
      setLoading(false)
      return
    }

    router.push(`/onboarding/baby?family_id=${family.id}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Welcome</h1>
          <p className="text-muted-foreground text-sm">Set up your family to get started</p>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md text-center">
            {error}
          </p>
        )}

        <Tabs defaultValue="create">
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1">Create family</TabsTrigger>
            <TabsTrigger value="join" className="flex-1">Join family</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card>
              <form onSubmit={handleCreate}>
                <CardHeader>
                  <CardTitle>Create a new family</CardTitle>
                  <CardDescription>You&apos;ll be the admin and can invite others.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="name">Family name</Label>
                    <Input id="name" name="name" placeholder="The Smith Family" required />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating..." : "Create family"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="join">
            <Card>
              <form onSubmit={handleJoin}>
                <CardHeader>
                  <CardTitle>Join an existing family</CardTitle>
                  <CardDescription>Ask your family admin for the invite code.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="invite_code">Invite code</Label>
                    <Input id="invite_code" name="invite_code" placeholder="abc12345" required />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Joining..." : "Join family"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
