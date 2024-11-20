/** @odoo-module **/

import {
    QUARTERS,
    COMPARISON_OPTIONS,
    sortPeriodOptions,
    MONTH_OPTIONS,
    QUARTER_OPTIONS,
    YEAR_OPTIONS,
    PER_YEAR,
} from "@web/search/utils/dates";
import * as dates from "@web/search/utils/dates";
import {Domain} from "@web/core/domain";
import {serializeDate, serializeDateTime} from "@web/core/l10n/dates";
import {localization} from "@web/core/l10n/localization";
import {_lt} from "@web/core/l10n/translation";

const {DateTime} = luxon;

export const referenceMoment = DateTime.local();

const LAST_DAYS = {
    7: {description: _lt("Last 7 days")},
    30: {description: _lt("Last 30 days")},
    365: {description: _lt("Last 365 days")},
};

export const NEW_OPTIONS = {
    this_day: {
        id: "this_day",
        groupNumber: 3,
        description: _lt("Today"),
        granularity: "day",
        plusParam: {},
    },
    this_yesterday: {
        id: "this_yesterday",
        groupNumber: 3,
        description: _lt("Yesterday"),
        granularity: "day",
        plusParam: {days: -1},
    },
    this_week: {
        id: "this_week",
        groupNumber: 3,
        description: _lt("This week"),
        granularity: "week",
        plusParam: {},
    },
    last_7_days: {
        id: "last_7_days",
        groupNumber: 4,
        description: LAST_DAYS[7].description,
        granularity: "day",
        plusParam: {},
        dateParams: {
            minus: {days: 7},
        },
    },
    last_30_days: {
        id: "last_30_days",
        groupNumber: 4,
        description: LAST_DAYS[30].description,
        granularity: "day",
        plusParam: {},
        dateParams: {
            minus: {days: 30},
        },
    },
    last_365_days: {
        id: "last_365_days",
        groupNumber: 4,
        description: LAST_DAYS[365].description,
        granularity: "day",
        plusParam: {},
        dateParams: {
            minus: {days: 365},
        },
    },
};

export const CUSTOM_PERIOD_OPTIONS = Object.assign(
    {},
    MONTH_OPTIONS,
    QUARTER_OPTIONS,
    YEAR_OPTIONS,
    NEW_OPTIONS
);

export const CUSTOM_PER_YEAR = {
    ...PER_YEAR,
    day: 365,
    week: 52,
};

export function getDateParams(selectedOptionIds) {
    const selectedOptions = [];
    for (const optionId of selectedOptionIds) {
        const option = CUSTOM_PERIOD_OPTIONS[optionId];
        if (option?.dateParams) {
            selectedOptions.push(option.dateParams);
        }
    }
    return selectedOptions;
}

export function customConstructDateDomain(
    referenceMoment,
    fieldName,
    fieldType,
    selectedOptionIds,
    comparisonOptionId
) {
    let plusParam;
    let selectedOptions;
    if (comparisonOptionId) {
        [plusParam, selectedOptions] = customGetComparisonParams(
            referenceMoment,
            selectedOptionIds,
            comparisonOptionId
        );
    } else {
        selectedOptions = customGetSelectedOptions(referenceMoment, selectedOptionIds);
    }
    const dateParams = getDateParams(selectedOptionIds);
    const yearOptions = selectedOptions.year;
    const otherOptions = [
        ...(selectedOptions.quarter || []),
        ...(selectedOptions.month || []),
        ...(selectedOptions.day || []),
        ...(selectedOptions.week || []),
    ];
    sortPeriodOptions(yearOptions);
    sortPeriodOptions(otherOptions);
    const ranges = [];
    for (const yearOption of yearOptions) {
        const constructRangeParams = {
            referenceMoment,
            fieldName,
            fieldType,
            plusParam,
            dateParams,
            comparisonOptionId,
        };
        if (otherOptions.length) {
            for (const option of otherOptions) {
                const setParam = Object.assign(
                    {},
                    yearOption.setParam,
                    option ? option.setParam : {}
                );
                const {granularity} = option;
                const range = customConstructDateRange(
                    Object.assign({granularity, setParam}, constructRangeParams)
                );
                ranges.push(range);
            }
        } else {
            const {granularity, setParam} = yearOption;
            const range = customConstructDateRange(
                Object.assign({granularity, setParam}, constructRangeParams)
            );
            ranges.push(range);
        }
    }
    const domain = Domain.combine(
        ranges.map((range) => range.domain),
        "OR"
    );
    const description = ranges.map((range) => range.description).join("/");
    return {domain, description};
}

export function customConstructDateRange(params) {
    const {
        referenceMoment,
        fieldName,
        fieldType,
        granularity,
        setParam,
        plusParam,
        dateParams,
        comparisonOptionId,
    } = params;
    if ("quarter" in setParam) {
        // Luxon does not consider quarter key in setParam (like moment did)
        setParam.month = QUARTERS[setParam.quarter].coveredMonths[0];
        delete setParam.quarter;
    }

    const date = referenceMoment.set(setParam).plus(plusParam || {});
    // compute domain
    const leftDate = date.minus(dateParams?.[0]?.minus || {}).startOf(granularity);
    const rightDate = date.endOf(granularity);
    let leftBound;
    let rightBound;
    if (fieldType === "date") {
        leftBound = serializeDate(leftDate);
        rightBound = serializeDate(rightDate);
    } else {
        leftBound = serializeDateTime(leftDate);
        rightBound = serializeDateTime(rightDate);
    }

    const domain = new Domain([
        "&",
        [fieldName, ">=", leftBound],
        [fieldName, "<=", rightBound],
    ]);
    // compute description
    const descriptions =
        granularity !== "day" && granularity !== "week" ? [date.toFormat("yyyy")] : [];
    const method = localization.direction === "rtl" ? "push" : "unshift";

    if (granularity === "day") {
        let description;
        const minusDays = dateParams?.[0]?.minus?.days;
        const isToday = referenceMoment.day === date.day;
        const isYesterday = referenceMoment.day - 1 === date.day;

        if (comparisonOptionId && minusDays) {
            description = `${_lt("From Date")} ${leftDate.toFormat(
                "dd LLL yyyy"
            )} ${_lt("Until")} ${rightDate.toFormat("dd LLL yyyy")}`;
        } else if (minusDays) {
            description = LAST_DAYS[dateParams[0].minus.days].description;
        } else if (!comparisonOptionId && (isToday || isYesterday)) {
            description = isToday ? _lt("Today") : _lt("Yesterday");
        } else {
            description = date.toFormat("dd LLL yyyy");
        }

        descriptions[method](description);
    }
    if (granularity === "week") {
        const comparisonDescription = `${_lt("Week")}: ${
            date.weekNumber
        } - ${date.toFormat("yyyy")}`;
        const description = comparisonOptionId
            ? comparisonDescription
            : _lt("This week");
        descriptions[method](description);
    }
    if (granularity === "month") {
        descriptions[method](date.toFormat("MMMM"));
    } else if (granularity === "quarter") {
        const quarter = date.quarter;
        descriptions[method](QUARTERS[quarter].description.toString());
    }
    const description = descriptions.join(" ");
    return {domain, description};
}

export function customGetPeriodOptions(referenceMoment) {
    // adapt when solution for moment is found...
    const options = [];
    const originalOptions = Object.values(CUSTOM_PERIOD_OPTIONS);
    for (const option of originalOptions) {
        const {id, groupNumber} = option;
        let description;
        let defaultYear;
        switch (option.granularity) {
            case "quarter":
            case "week":
            case "day":
                description = option.description.toString();
                defaultYear = referenceMoment.set(option.setParam).year;
                break;
            case "month":
            case "year": {
                const date = referenceMoment.plus(option.plusParam);
                description = date.toFormat(option.format);
                defaultYear = date.year;
                break;
            }
        }
        const setParam = customGetSetParam(option, referenceMoment);
        options.push({id, groupNumber, description, defaultYear, setParam});
    }
    const periodOptions = [];
    for (const option of options) {
        const {id, groupNumber, description, defaultYear} = option;
        const yearOption = options.find(
            (o) => o.setParam && o.setParam.year === defaultYear
        );
        periodOptions.push({
            id,
            groupNumber,
            description,
            defaultYearId: yearOption.id,
        });
    }
    return periodOptions;
}

export function customGetSelectedOptions(referenceMoment, selectedOptionIds) {
    const selectedOptions = {year: []};
    for (const optionId of selectedOptionIds) {
        const option = CUSTOM_PERIOD_OPTIONS[optionId];
        const setParam = customGetSetParam(option, referenceMoment);
        const granularity = option.granularity;
        if (!selectedOptions[granularity]) {
            selectedOptions[granularity] = [];
        }
        selectedOptions[granularity].push({granularity, setParam});
    }
    return selectedOptions;
}

export function customGetSetParam(periodOption, referenceMoment) {
    if (periodOption.granularity === "quarter") {
        return periodOption.setParam;
    }
    const date = referenceMoment.plus(periodOption.plusParam);
    const granularity = periodOption.granularity;
    const setParam = {[granularity]: date[granularity]};
    return setParam;
}

export function customGetComparisonParams(
    referenceMoment,
    selectedOptionIds,
    comparisonOptionId
) {
    const comparisonOption = COMPARISON_OPTIONS[comparisonOptionId];
    const selectedOptions = customGetSelectedOptions(
        referenceMoment,
        selectedOptionIds
    );
    if (comparisonOption.plusParam) {
        return [comparisonOption.plusParam, selectedOptions];
    }
    const plusParam = {};
    const granularities = ["month", "quarter", "day", "week"];
    let globalGranularity =
        granularities.find((granularity) => selectedOptions[granularity]) || "year";
    const granularityFactor = CUSTOM_PER_YEAR[globalGranularity];
    const years = selectedOptions.year.map((o) => o.setParam.year);
    const yearMin = Math.min(...years);
    const yearMax = Math.max(...years);
    let optionMin = 0;
    let optionMax = 0;
    if (selectedOptions.quarter) {
        const quarters = selectedOptions.quarter.map((o) => o.setParam.quarter);
        if (globalGranularity === "month") {
            delete selectedOptions.quarter;
            for (const quarter of quarters) {
                for (const month of QUARTERS[quarter].coveredMonths) {
                    const monthOption = selectedOptions.month.find(
                        (o) => o.setParam.month === month
                    );
                    if (!monthOption) {
                        selectedOptions.month.push({
                            setParam: {month},
                            granularity: "month",
                        });
                    }
                }
            }
        } else {
            optionMin = Math.min(...quarters);
            optionMax = Math.max(...quarters);
        }
    }
    if (selectedOptions.month) {
        const months = selectedOptions.month.map((o) => o.setParam.month);
        optionMin = Math.min(...months);
        optionMax = Math.max(...months);
    }
    const num = -1 + granularityFactor * (yearMin - yearMax) + optionMin - optionMax;
    const granularityMapping = {
        year: "years",
        month: "months",
        week: "weeks",
        day: "days",
        quarter: "quarters",
    };
    const key = granularityMapping[globalGranularity] || "quarters";
    plusParam[key] = num;
    return [plusParam, selectedOptions];
}

dates.constructDateDomain = customConstructDateDomain;
dates.constructDateRange = customConstructDateRange;
dates.getPeriodOptions = customGetPeriodOptions;
dates.getSelectedOptions = customGetSelectedOptions;
dates.getSetParam = customGetSetParam;
dates.getComparisonParams = customGetComparisonParams;
dates.PERIOD_OPTIONS = CUSTOM_PERIOD_OPTIONS;
dates.PER_YEAR = CUSTOM_PER_YEAR;
