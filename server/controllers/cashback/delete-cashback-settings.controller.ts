import { Request, Response } from 'express';
import { deleteCashbackSettings, DeleteCashbackSettingsInput } from 'server/db/functions/delete-cashback-settings';



 export async function  deleteCashbackSettingsController(req: Request, res: Response)  {
  try {
    const validationResult = DeleteCashbackSettingsInput.safeParse(req.params);

    if (!validationResult.success) {
      return res.status(400).json({
        message: 'ID de configuração de cashback inválido.',
        errors: validationResult.error.flatten(),
      });
    }

    const { id } = validationResult.data;

    const deletedSetting = await deleteCashbackSettings({ id });

    if (!deletedSetting) {
      return res.status(404).json({ message: 'Configuração de cashback não encontrada.' });
    }

    return res.status(200).json({
      message: 'Configuração de cashback deletada com sucesso!',
      deletedSetting,
    });
  } catch (error) {
    console.error('Erro ao deletar configuração de cashback:', error);
    return res.status(500).json({ message: 'Erro interno do servidor ao deletar a configuração.' });
  }
}

