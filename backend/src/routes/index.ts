import { Router } from "express"
import { aiRouter } from "./ai"
import { authRouter } from "./auth"
import { healthRouter } from "./health"
import { profileRouter } from "./profile"
import { repositoriesRouter } from "./repositories"
import { reportsRouter } from "./reports"
import { scansRouter } from "./scans"
import { staticAnalysisRouter } from "./static-analysis"
import { teamRouter } from "./team"
import { uploadsRouter } from "./uploads"

export const apiRouter = Router()

apiRouter.use("/auth", authRouter)
apiRouter.use("/ai", aiRouter)
apiRouter.use("/health", healthRouter)
apiRouter.use("/profile", profileRouter)
apiRouter.use("/repositories", repositoriesRouter)
apiRouter.use("/reports", reportsRouter)
apiRouter.use("/scans", scansRouter)
apiRouter.use("/static-analysis", staticAnalysisRouter)
apiRouter.use("/team", teamRouter)
apiRouter.use("/uploads", uploadsRouter)
