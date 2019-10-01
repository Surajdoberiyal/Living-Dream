import asdf from 'express'
import _ from "lodash";
import moment from "moment";

import { errorObj, successObj } from "../../config/settings";
import { BatchSchema, BatchDocument } from "../models/Batch";
import { API_RESP } from "../../config/settings";
import { getField } from './_utils';

export default {
    add: (data: any): Promise<API_RESP> => {
        return new Promise((resolve) => {
            let check = BatchSchema.count({ instituteId: data.instituteId, batchName: data.batchName }).collation({ locale: 'en', strength: 1 })
            check.exec((err, number) => {
                if (number > 0) {
                    return resolve({ ...errorObj, message: `This name is already exist.`, err })
                }
                else {
                    let Batch = new BatchSchema();
                    _.each(data, (value: any, key: keyof BatchDocument) => {
                        (Batch[key] as any) = value;
                    });
                    Batch.save((err, result) => {
                        if (err || !result) {
                            if (err.code == 11000) {
                                return resolve({ ...errorObj, message: `This ${getField(err)} is already exist.`, err })
                            }
                            return resolve({ ...errorObj, message: "unable to add batch", data: result, err });
                        }

                        return resolve({ ...successObj, message: "batch added successfully", data: result });
                    })
                }
            })
        });
    },
    edit: (id: any, data: any): Promise<API_RESP> => {
        return new Promise((resolve) => {
            let check = BatchSchema.count({ _id: { $ne: id }, instituteId: data.instituteId, batchName: data.batchName }).collation({ locale: 'en', strength: 1 })
            check.exec((err, number) => {
                if (number > 0) {
                    return resolve({ ...errorObj, message: `This name is already exist.`, err })
                }
                else {
                    let bEdit = BatchSchema.findById(id);
                    bEdit.exec((error, result: any) => {
                        if (error) {
                            return resolve({ ...errorObj, message: "unable to find batch", err: error });
                        }
                        _.each(data, (value: any, key: any) => {
                            if (key != "dayArray" && key != "tempArray") {
                                const key1: (keyof BatchDocument) = key;
                                result[key1] = value;
                            }
                        });
                        let obj: any = {};
                        let arr = result.tempArray.map((day: any) => day.day);
                        const today = moment();
                        if (data.tempArray && data.tempArray.length > 0) {
                            _.each(data.tempArray, (value, index) => {
                                _.each(result.tempArray, value2 => {
                                    if (value.day === value2.day) {
                                        if (today.day() > value2.day) {
                                            value2.date = moment().add(1, "weeks").isoWeekday(value2.day).format("L");
                                        }
                                        else {
                                            value2.date = moment().isoWeekday(value2.day).format("L");
                                        }
                                        value2.start = value.start;
                                        value2.end = value.end;
                                        value2.off = value.off;
                                    }
                                });

                                const dateCond = moment().add(1, "weeks").isoWeekday(value.day).format("L")
                                if (!arr.includes(value.day)) {
                                  const  isCurrentDay=result.dayArray[index]
                                  
                                    if (isCurrentDay.day == value.day &&
                                        moment(isCurrentDay.start).format('hh:mm') != moment(value.start).format('hh:mm') ||
                                        moment(isCurrentDay.end).format('hh:mm') != moment(value.end).format('hh:mm') ||
                                        result.dayArray[index].off != value.off
                                    ) {
                                        obj.day = value.day;
                                        obj.start = value.start;
                                        obj.end = value.end;
                                        obj.off = value.off;
                                        obj.date = moment().day() > value.day ? dateCond : moment().isoWeekday(value.day).format("L");
                                        result.tempArray.push(obj);
                                    }
                                }
                            });
                        }
                        if (data.dayArray && data.dayArray.length > 0) {
                            let temp: any = []
                            _.each(data.dayArray, value => {
                                _.each(result.dayArray, value2 => {
                                    if (value.day == value2.day) {
                                        value2.day = value.day;
                                        value2.start = value.start;
                                        value2.end = value.end;
                                        value2.off = value.off;
                                    }
                                });
                                _.each(result.tempArray, (val, i) => {
                                    if (value.day === val.day && moment(value.start).isSame(val.start, 'week')) {
                                        temp.push(i)
                                    }
                                });

                            });
                            for (let i = temp.length - 1; i >= 0; i--)
                                result.tempArray.splice(temp[i], 1);
                        }
                        result.save((err: any, data: BatchDocument) => {
                            if (err) {
                                if (err.code == 11000) {
                                    return resolve({ ...errorObj, message: `This ${getField(err)} is already exist.`, err })
                                }
                                return resolve({ ...errorObj, message: "unable to save the changes", err });
                            }
                            return resolve({ ...successObj, message: "batch updated", data });

                        })

                    });
                }
            })
        });
    },
    get: (id: any): Promise<API_RESP> => {
        return new Promise((resolve) => {
            let Batch = BatchSchema.findById(id)
                .populate({
                    path: 'courseId',
                    populate: {
                        path: 'subjectArray'
                    }
                })
                .populate('branchId')
                .populate('subjects.subjectId')
            Batch.exec((err, data2) => {
                if (err) {
                    return resolve({ ...errorObj, message: "couldn't find the batch", err });
                }
                return resolve({ ...successObj, message: "batch found", data: data2 });
            });
        });
    },
    delete: (data: string[]): Promise<API_RESP> => {
        return new Promise((resolve) => {
            //@ts-ignore
            BatchSchema.delete({ _id: { $in: data } })
                .exec((err: any, data: any) => {
                    if (err || !data) {
                        return resolve({ err, ...errorObj, message: "error in deleting", data });
                    }
                    if (data.nModified == 0) {
                        return resolve({ ...errorObj, message: "batch not found", err });
                    } else {
                        return resolve({ ...successObj, message: "batch deleted", data });
                    }
                });

        });
    },
    all: (data?: any): Promise<API_RESP> => {
        return new Promise((resolve) => {
            let Batch = BatchSchema.find(data)
                .populate({
                    path: 'courseId',
                    populate: {
                        path: 'subjectArray'
                    }
                })
                .populate('branchId')
                .populate('subjects.subjectId')
            Batch.exec((error, data2) => {
                if (error) {
                    return resolve({ ...errorObj, message: "couldn't find the batch", err: error });
                }
                return resolve({ ...successObj, message: "batch found", data: data2 });
            });
        });
    },
    restore: (data: string[]): Promise<object> => {
        return new Promise((resolve) => {
            //@ts-ignore
            BatchSchema.restore({ _id: { $in: data } }, function (err, result) {
                if (err) {
                    return resolve({ ...errorObj, message: "cannot restore", err })
                }
                if (result.nModified == 0) {
                    return resolve({ ...errorObj, message: "batch not found", err });
                }
                return resolve({ ...successObj, message: "restore successfully", data: result })
            });
        })
    },
    check: (id: any): Promise<number> => {
        return new Promise((resolve) => {

            let view = BatchSchema.count({ courseId: id })
            return resolve(view)
        });
    },

};


asdf.get()
