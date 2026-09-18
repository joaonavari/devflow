import type { RequestHandler, Response } from 'express';
import * as portal from '../services/portal.service.js';
import * as stages from '../services/project-stage.service.js';
import {
  createPortalSchema,
  createStageSchema,
  updateStageSchema,
  moveStageSchema,
  portalProjectIdSchema,
  stageIdSchema,
} from '../validators/portal.schemas.js';
function userId(response: Response): string {
  const user: unknown = response.locals.user;
  if (!user || typeof user !== 'object' || !('id' in user) || typeof user.id !== 'string')
    throw new Error('Usuário ausente.');
  return user.id;
}
export const state: RequestHandler = async (req, res) => {
  res.json({
    data: await portal.getPortalState(
      userId(res),
      portalProjectIdSchema.parse(req.params.projectId),
    ),
  });
};
export const generate: RequestHandler = async (req, res) => {
  const input = createPortalSchema.parse(req.body);
  res.status(201).json({
    data: await portal.generatePortal(
      userId(res),
      portalProjectIdSchema.parse(req.params.projectId),
      input.validityDays,
    ),
  });
};
export const revoke: RequestHandler = async (req, res) => {
  await portal.revokePortal(userId(res), portalProjectIdSchema.parse(req.params.projectId));
  res.sendStatus(204);
};
export const read: RequestHandler = async (req, res) => {
  res.json({ data: await portal.readPortal(req.params.token) });
};
export const listStages: RequestHandler = async (req, res) => {
  res.json({
    data: await stages.listStages(userId(res), portalProjectIdSchema.parse(req.params.projectId)),
  });
};
export const createStage: RequestHandler = async (req, res) => {
  res.status(201).json({
    data: await stages.createStage(
      userId(res),
      portalProjectIdSchema.parse(req.params.projectId),
      createStageSchema.parse(req.body),
    ),
  });
};
export const updateStage: RequestHandler = async (req, res) => {
  res.json({
    data: await stages.updateStage(
      userId(res),
      stageIdSchema.parse(req.params.stageId),
      updateStageSchema.parse(req.body),
    ),
  });
};
export const moveStage: RequestHandler = async (req, res) => {
  res.json({
    data: await stages.moveStage(
      userId(res),
      stageIdSchema.parse(req.params.stageId),
      moveStageSchema.parse(req.body).position,
    ),
  });
};
export const deleteStage: RequestHandler = async (req, res) => {
  await stages.deleteStage(userId(res), stageIdSchema.parse(req.params.stageId));
  res.sendStatus(204);
};
