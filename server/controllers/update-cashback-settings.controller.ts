import {  type Request, type Response } from "express";
import { updateCashbackSettings, updateCashbackSettingsSchema } from "server/db/functions/update-cashback-settings";



/**
 * @description Updates a specific cashback setting.
 * @access Private (assumed, based on typical admin functionality)
 */

  export async function updateCashbackSettingsController(req: Request, res: Response)  {
    try {
      // Combine route parameters and request body for a single validation object
      const dataToValidate = {
        id: req.params.id,
        ...req.body,
      };

      // Use safeParse for graceful validation error handling without crashing
      const validationResult = updateCashbackSettingsSchema.safeParse(dataToValidate);

      if (!validationResult.success) {
        // If validation fails, return a 400 error with detailed field errors
        return res.status(400).json({
          message: "Invalid input data provided.",
          errors: validationResult.error.flatten().fieldErrors,
        });
      }

      // Call the database function with the validated data
      const updatedSetting = await updateCashbackSettings(validationResult.data);

      // Return a 200 OK response with the updated setting
      return res.status(200).json(updatedSetting);

    } catch (error) {
      // Log the error for debugging purposes
      console.error(`[PATCH /api/cashback-settings/:id] - Error:`, error);

      // Handle specific, known errors first
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message });
        }
        // Handle cases where no actual data was sent for update
        if (error.message.includes("No fields to update")) {
          return res.status(400).json({ message: error.message });
        }
      }

      // For all other unexpected errors, return a generic 500 server error
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

