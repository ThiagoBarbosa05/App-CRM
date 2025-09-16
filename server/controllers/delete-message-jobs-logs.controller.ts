import { Request, Response } from 'express';
import { deleteMessageJobsLog, DeleteMessageJobsLogInput } from '../db/functions/delete-message-jobs-logs';

export async function deleteMessageJobsLogController(req: Request, res: Response) {
  try {
    const validationResult = DeleteMessageJobsLogInput.safeParse(req.params);

    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid message jobs log ID.',
        errors: validationResult.error.flatten(),
      });
    }

    const { id } = validationResult.data;
    const deletedLog = await deleteMessageJobsLog({ id });

    if (!deletedLog) {
      return res.status(404).json({ message: 'Message jobs log not found.' });
    }

    return res.status(200).json({
      message: 'Message jobs log deleted successfully!',
      deletedLog,
    });
  } catch (error) {
    console.error('Error deleting message jobs log:', error);
    return res.status(500).json({ message: 'Internal server error when deleting the log.' });
  }
}