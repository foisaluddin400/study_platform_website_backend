import { Request, Response, NextFunction } from "express";
import { Task } from "../models/Task";
import { Student } from "../models/Student";
import { User } from "../models/User";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { notificationService } from "../services/notification.service";

export const getTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, priority, category, search } = req.query;

    const filter: Record<string, any> = {
      agencyId: req.user?.agencyId,
    };

    if (status && status !== "All") {
      filter.status = status;
    }

    if (priority && priority !== "All") {
      filter.priority = priority;
    }

    if (category && category !== "All") {
      filter.category = category;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$or = [{ title: searchRegex }, { description: searchRegex }, { assignedTo: searchRegex }];
    }

    const tasks = await Task.find(filter).sort({ dueDate: 1 });
    sendSuccess(res, "Tasks retrieved", tasks);
  } catch (error) {
    next(error);
  }
};

export const getMyTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let student = await Student.findOne({
      agencyId: req.user?.agencyId,
      $or: [{ user: req.user?.userId }, { email: req.user?.email }],
    });

    const filter: Record<string, any> = {
      agencyId: req.user?.agencyId,
      $or: [
        { assignedTo: req.user?.name },
        ...(student ? [{ student: student._id }] : []),
      ],
    };

    const tasks = await Task.find(filter).sort({ dueDate: 1 });
    sendSuccess(res, "My tasks", tasks);
  } catch (error) {
    next(error);
  }
};

export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, description, studentId, assignedTo, priority, dueDate, category } = req.body;

    let studentName: string | undefined;
    if (studentId) {
      const student = await Student.findOne({ _id: studentId, agencyId: req.user?.agencyId });
      studentName = student?.name;
    }

    const task = new Task({
      agencyId: req.user?.agencyId,
      title,
      description,
      student: studentId,
      studentName,
      assignedTo: assignedTo || req.user?.name || "Staff Member",
      priority: priority || "Medium",
      dueDate: dueDate || "Tomorrow",
      category: category || "General",
      createdBy: req.user?.userId,
    });

    await task.save();

    // Notify assigned staff member if found
    if (task.assignedTo && req.user?.agencyId) {
      const agencyId = req.user.agencyId;
      User.findOne({ agencyId, name: task.assignedTo }).then((assignedUser) => {
        if (assignedUser) {
          notificationService.sendToUser({
            agencyId,
            userId: assignedUser._id,
            title: `New Task Assigned: ${task.title}`,
            message: `Priority: ${task.priority}. Due date: ${task.dueDate}. Category: ${task.category}.`,
            type: "task",
            link: "/dashboard/tasks",
          }).catch((e) => console.error("Error sending task notification:", e));
        }
      }).catch(() => {});
    }

    sendSuccess(res, "Task created successfully", task, 201);
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updates: Record<string, any> = { ...req.body };

    if (req.body.studentId) {
      const student = await Student.findOne({
        _id: req.body.studentId,
        agencyId: req.user?.agencyId,
      });
      if (student) {
        updates.student = student._id;
        updates.studentName = student.name;
      }
    } else if (req.body.studentId === "" || req.body.studentId === null) {
      updates.student = null;
      updates.studentName = "";
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, agencyId: req.user?.agencyId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!task) {
      return next(new AppError("Task not found.", 404));
    }

    // Notify assigned staff member if assignedTo changed or status updated
    if (req.body.assignedTo && req.user?.agencyId) {
      const agencyId = req.user.agencyId;
      User.findOne({ agencyId, name: req.body.assignedTo }).then((assignedUser) => {
        if (assignedUser) {
          notificationService.sendToUser({
            agencyId,
            userId: assignedUser._id,
            title: `Task Updated: ${task.title}`,
            message: `Status: ${task.status}. Priority: ${task.priority}. Due: ${task.dueDate}.`,
            type: "task",
            link: "/dashboard/tasks",
          }).catch((e) => console.error("Error sending task update notification:", e));
        }
      }).catch(() => {});
    }

    sendSuccess(res, "Task updated successfully", task);
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!task) {
      return next(new AppError("Task not found.", 404));
    }

    sendSuccess(res, "Task deleted successfully.");
  } catch (error) {
    next(error);
  }
};
