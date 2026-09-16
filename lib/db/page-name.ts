import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { trackedSources } from "@/lib/db/schema";

/**
 * What the team calls a page, as opposed to what the scraper called it.
 *
 * Three tables hold a name for the same Facebook page and none of them agree.
 * `tracked_sources.display_name` is what somebody typed on /sources — "Việt
 * Tân". `facebook_page_profiles.display_name` is whatever label the
 * classification panel happened to be handed, which for a page discovered from
 * evidence is the bare handle. `sources.title` is frozen at whatever the label
 * was when the first scan was created. So the same page reads as "Việt Tân" on
 * one screen and "viettan" on the next, and a reader has no way to tell they
 * are the same page.
 *
 * Only one of the three is edited by a person, so only one of them is a name.
 * These fragments let every read path resolve it the same way.
 */

/** The handle out of a Facebook page URL — `.../viettan` becomes `viettan`. */
export function facebookHandleFromUrl(urlExpression: SQL | unknown) {
    return sql<string | null>`(select nullif(substr(path,1,instr(path || '/', '/')-1),'') from (
        select case when lower(${urlExpression}) like 'https://facebook.com/%'
            or lower(${urlExpression}) like 'http://facebook.com/%'
            or lower(${urlExpression}) like 'https://www.facebook.com/%'
            or lower(${urlExpression}) like 'http://www.facebook.com/%'
        then substr(lower(${urlExpression}),instr(lower(${urlExpression}),'facebook.com/')+13)
        else lower(${urlExpression}) end as path
    ))`;
}

/** A handle written as an author string — @Viet Tan becomes viettan. */
export function facebookHandleFromAuthor(authorExpression: SQL | unknown) {
    return sql<string | null>`nullif(lower(replace(replace(replace(replace(replace(replace(replace(
        case when substr(trim(coalesce(${authorExpression},'')),1,1)='@' then substr(trim(${authorExpression}),2) else trim(coalesce(${authorExpression},'')) end,
        ' ',''),char(9),''),char(10),''),char(11),''),char(12),''),char(13),''),char(160),'')),'')`;
}

/**
 * The team's name for the page with this handle, or null if none is followed.
 *
 * A correlated subquery rather than a join: two tracked rows can normalise to
 * the same handle — a trailing slash is enough — and a join on that would
 * silently duplicate every row of whatever query it was added to.
 */
export function trackedSourceNameForHandle(handleExpression: SQL) {
	return sql<string | null>`(
		select nullif(trim(${trackedSources.displayName}), '')
		from ${trackedSources}
		where ${facebookHandleFromUrl(trackedSources.normalizedUrl)} = ${handleExpression}
		order by ${trackedSources.updatedAt} desc
		limit 1
	)`;
}
