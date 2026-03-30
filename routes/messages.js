var express = require("express");
var router = express.Router();
let mongoose = require("mongoose");

let messageModel = require("../schemas/messages");
let userModel = require("../schemas/users");
let { checkLogin } = require("../utils/authHandler.js");
let { uploadFile } = require("../utils/uploadHandler");

router.get("/:userId", checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.userId;
        let otherUserId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).send({ message: "userId khong hop le" });
        }

        let messages = await messageModel.find({
            $or: [
                { from: currentUserId, to: otherUserId },
                { from: otherUserId, to: currentUserId }
            ]
        })
            .populate("from", "username email fullName avatarUrl")
            .populate("to", "username email fullName avatarUrl")
            .sort({ createdAt: 1 });

        res.send(messages);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.post("/:userId", checkLogin, uploadFile.single("file"), async function (req, res, next) {
    try {
        let currentUserId = req.userId;
        let otherUserId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).send({ message: "userId khong hop le" });
        }

        if (currentUserId === otherUserId) {
            return res.status(400).send({ message: "khong the gui tin nhan cho chinh minh" });
        }

        let receiver = await userModel.findOne({ _id: otherUserId, isDeleted: false });
        if (!receiver) {
            return res.status(404).send({ message: "nguoi nhan khong ton tai" });
        }

        let messageContent;
        if (req.file) {
            messageContent = {
                type: "file",
                text: req.file.path
            };
        } else if (typeof req.body.text === "string" && req.body.text.trim()) {
            messageContent = {
                type: "text",
                text: req.body.text.trim()
            };
        } else {
            return res.status(400).send({
                message: "noi dung khong hop le, can gui text hoac file"
            });
        }

        let newMessage = new messageModel({
            from: currentUserId,
            to: otherUserId,
            messageContent: messageContent
        });

        let result = await newMessage.save();
        result = await result.populate("from", "username email fullName avatarUrl");
        result = await result.populate("to", "username email fullName avatarUrl");

        res.send(result);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.get("/", checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.userId;

        let allMessages = await messageModel.find({
            $or: [
                { from: currentUserId },
                { to: currentUserId }
            ]
        })
            .populate("from", "username email fullName avatarUrl")
            .populate("to", "username email fullName avatarUrl")
            .sort({ createdAt: -1 });

        let checkedUsers = new Set();
        let lastMessages = [];

        for (let message of allMessages) {
            let otherUserId;

            if (message.from._id.toString() === currentUserId) {
                otherUserId = message.to._id.toString();
            } else {
                otherUserId = message.from._id.toString();
            }

            if (!checkedUsers.has(otherUserId)) {
                checkedUsers.add(otherUserId);
                lastMessages.push(message);
            }
        }

        res.send(lastMessages);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;
