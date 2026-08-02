export declare const promptSelect: ({ message, options, active, inactive, }: {
    message: string;
    options: string[];
    active?: (s: string) => string;
    inactive?: (s: string) => string;
}) => Promise<number>;
export declare const promptConfirm: ({ message, }: {
    message: string;
    password?: boolean;
}) => Promise<boolean>;
export declare const promptText: ({ message, default: def, password, min, }: {
    message: string;
    default?: string;
    password?: boolean;
    min?: number;
}) => Promise<string>;
