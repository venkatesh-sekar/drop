import { json, withUser } from "@/lib/api"
import { userIsAdmin } from "@/lib/auth"

export const GET = withUser(async (_request, user) =>
  json({
    user: {
      id: user.id,
      display_name: user.display_name,
      email: user.email,
      is_admin: userIsAdmin(user),
    },
  }),
)
