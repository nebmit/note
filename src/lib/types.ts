/**
 * The whole user model: `uuid` is the stable account id to key rows on,
 * `elevated` is the only role bit. Kept out of `$lib/server` so client
 * components can import the type without tripping the server-only guard.
 */
export interface SsoUser {
    uuid: string;
    elevated: boolean;
}
