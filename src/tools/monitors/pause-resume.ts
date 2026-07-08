import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { toToolErrorResult } from '../../api/errors.js'
import { jsonResult } from '../result.js'
import type { ToolContext } from '../types.js'
import { monitorSummaryOutputShape, type RawMonitor, toMonitorSummary } from './shared.js'

export const pauseResumeOutputShape = {
  monitor: z.object(monitorSummaryOutputShape),
}

export const pauseResumeInputShape = {
  monitor_id: z.string().min(1).describe('The monitor id (from list_monitors).'),
}

type PauseResumeArgs = { monitor_id: string }

async function transition(ctx: ToolContext, monitorId: string, action: 'pause' | 'resume'): Promise<CallToolResult> {
  try {
    const body = await ctx.api.request<{ monitor?: RawMonitor }>({
      method: 'POST',
      path: `/v1/monitors/${encodeURIComponent(monitorId)}/${action}`,
    })
    const monitor = body.monitor ?? (body as unknown as RawMonitor)
    return jsonResult({ monitor: toMonitorSummary(monitor) })
  } catch (error) {
    return toToolErrorResult(error)
  }
}

export function pauseMonitor(ctx: ToolContext, args: PauseResumeArgs): Promise<CallToolResult> {
  return transition(ctx, args.monitor_id, 'pause')
}

export function resumeMonitor(ctx: ToolContext, args: PauseResumeArgs): Promise<CallToolResult> {
  return transition(ctx, args.monitor_id, 'resume')
}

export function registerPauseMonitor(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'pause_monitor',
    {
      title: 'Pause monitor',
      description: 'Pause a monitor by id. It stops running checks and sending alerts until resumed.',
      inputSchema: pauseResumeInputShape,
      outputSchema: pauseResumeOutputShape,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    (args) => pauseMonitor(ctx, args)
  )
}

export function registerResumeMonitor(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'resume_monitor',
    {
      title: 'Resume monitor',
      description: 'Resume a paused monitor by id.',
      inputSchema: pauseResumeInputShape,
      outputSchema: pauseResumeOutputShape,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    (args) => resumeMonitor(ctx, args)
  )
}
