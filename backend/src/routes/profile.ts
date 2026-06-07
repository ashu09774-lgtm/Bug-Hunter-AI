import { Router } from "express"
import { requireAuth } from "../middleware/auth"
import {
  changePassword,
  changePasswordSchema,
  getProfile,
  updatePreferences,
  updatePreferencesSchema,
  updateProfile,
  updateProfileSchema,
} from "../services/profile-service"

export const profileRouter = Router()

profileRouter.use(requireAuth)

profileRouter.get("/me", async (req, res, next) => {
  try {
    const user = await getProfile(req.user!.id)

    res.json({
      success: true,
      data: { user },
    })
  } catch (error) {
    next(error)
  }
})

profileRouter.patch("/me", async (req, res, next) => {
  try {
    const input = updateProfileSchema.parse(req.body)
    const user = await updateProfile(req.user!.id, input)

    res.json({
      success: true,
      data: { user },
    })
  } catch (error) {
    next(error)
  }
})

profileRouter.patch("/preferences", async (req, res, next) => {
  try {
    const input = updatePreferencesSchema.parse(req.body)
    const user = await updatePreferences(req.user!.id, input)

    res.json({
      success: true,
      data: { user },
    })
  } catch (error) {
    next(error)
  }
})

profileRouter.post("/change-password", async (req, res, next) => {
  try {
    const input = changePasswordSchema.parse(req.body)
    await changePassword(req.user!.id, input)

    res.json({
      success: true,
    })
  } catch (error) {
    next(error)
  }
})
