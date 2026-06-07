import { Router } from "express"

import {
  buildAnalytics,
  buildCsvReport,
  buildJsonReport,
  buildPdfReport,
  createShareLink,
  getReportScan,
  getSharedReport,
} from "../services/report-service"
import { AppError } from "../middleware/error-handler"

export const reportsRouter = Router()

function requireScan(scanId: string) {
  const scan = getReportScan(scanId)
  if (!scan) {
    throw new AppError("Report scan not found", 404, "REPORT_NOT_FOUND")
  }

  return scan
}

reportsRouter.get("/analytics", (_req, res) => {
  res.json({ success: true, data: buildAnalytics() })
})

reportsRouter.get("/share/:token", (req, res, next) => {
  try {
    const scan = getSharedReport(req.params.token)
    if (!scan) {
      throw new AppError("Shared report not found", 404, "SHARED_REPORT_NOT_FOUND")
    }

    res.json({ success: true, data: buildJsonReport(scan) })
  } catch (error) {
    next(error)
  }
})

reportsRouter.post("/:scanId/share", (req, res, next) => {
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`
    const share = createShareLink(req.params.scanId, baseUrl)
    if (!share) {
      throw new AppError("Report scan not found", 404, "REPORT_NOT_FOUND")
    }

    res.json({ success: true, data: share })
  } catch (error) {
    next(error)
  }
})

reportsRouter.get("/:scanId/json", (req, res, next) => {
  try {
    const scan = requireScan(req.params.scanId)

    res.setHeader("Content-Disposition", `attachment; filename="${scan.id}.json"`)
    res.json({ success: true, data: buildJsonReport(scan) })
  } catch (error) {
    next(error)
  }
})

reportsRouter.get("/:scanId/csv", (req, res, next) => {
  try {
    const scan = requireScan(req.params.scanId)

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="${scan.id}.csv"`)
    res.send(buildCsvReport(scan))
  } catch (error) {
    next(error)
  }
})

reportsRouter.get("/:scanId/pdf", (req, res, next) => {
  try {
    const scan = requireScan(req.params.scanId)

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${scan.id}.pdf"`)
    res.send(buildPdfReport(scan))
  } catch (error) {
    next(error)
  }
})
