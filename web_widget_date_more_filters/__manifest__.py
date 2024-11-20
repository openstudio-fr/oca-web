# Copyright OpenStudio 2024
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Web date widget more filters",
    "category": "web",
    "version": "16.0.1.0.0",
    "website": "https://github.com/OCA/web",
    "author": "Elise Gigot <egigot@openstudio.fr>",
    "depends": ["web", "hr_timesheet"],
    "summary": "Add some filters to the date filters wdidget",
    "license": "AGPL-3",
    "installable": True,
    "assets": {
        "web.assets_backend": [
            "web_widget_date_more_filters/static/src/js/web_widget_date_more_filters.js",
        ],
    },
}
