import mongoose from "mongoose";
import Asset from "../models/assetModel.js";

export const createAsset = async (req, res) => {
  try {
    const { assetName, assetType, value, purchaseDate } = req.body;
    if (!assetName || !assetType || value === undefined) {
      return res.status(400).json({ success: false, message: "Missing required asset fields." });
    }

    const numericValue = Number(value);
    if (isNaN(numericValue) || numericValue < 0) {
      return res.status(400).json({ success: false, message: "Value must be a non-negative number." });
    }

    const asset = await Asset.create({
      userId: req.user.id,
      assetName,
      assetType,
      value: numericValue,
      purchaseDate: purchaseDate || Date.now()
    });

    res.status(201).json({ success: true, data: asset });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyAssets = async (req, res) => {
  try {
    const assets = await Asset.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: assets.length, data: assets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { assetName, assetType, value } = req.body;

    if (value !== undefined && (isNaN(Number(value)) || Number(value) < 0)) {
      return res.status(400).json({ success: false, message: "Asset value cannot be negative" });
    }

    const asset = await Asset.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: { assetName, assetType, value } },
      { new: true, runValidators: true }
    );

    if (!asset) {
      return res.status(404).json({ success: false, message: "Asset not found or unauthorized" });
    }

    res.status(200).json({ success: true, data: asset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await Asset.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!asset) {
      return res.status(404).json({ success: false, message: "Asset not found or unauthorized" });
    }

    res.status(200).json({ success: true, message: "Asset removed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const startTime = Date.now();

    const summary = await Asset.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$assetType",
          totalValue: { $sum: "$value" },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalNetWorth = summary.reduce((acc, curr) => acc + curr.totalValue, 0);
    const executionTimeMs = Date.now() - startTime;

    res.status(200).json({
      success: true,
      executionTimeMs,
      totalNetWorth,
      allocation: summary
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
