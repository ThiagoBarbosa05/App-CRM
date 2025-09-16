import { Request, Response } from 'express';
import { deleteMessageAutomationSettings, DeleteMessageAutomationSettingsInput } from '../db/functions/delete-message-automation-settings';

export async function deleteMessageAutomationSettingsController(req: Request, res: Response) {
  try {
    const validationResult = DeleteMessageAutomationSettingsInput.safeParse(req.params);

    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid message automation setting ID.',
        errors: validationResult.error.flatten(),
      });
    }

    const { id } = validationResult.data;
    const deletedSetting = await deleteMessageAutomationSettings({ id });

    if (!deletedSetting) {
      return res.status(404).json({ message: 'Message automation setting not found.' });
    }

    return res.status(200).json({
      message: 'Message automation setting deleted successfully!',
      deletedSetting,
    });
  } catch (error) {
    console.error('Error deleting message automation setting:', error);
    return res.status(500).json({ message: 'Internal server error when deleting the setting.' });
  }
}