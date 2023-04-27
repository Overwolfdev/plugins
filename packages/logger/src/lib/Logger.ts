import { Logger as BuiltinLogger, LogLevel, type LogMethods } from '@sapphire/framework';
import { bgRed, cyan, gray, isColorSupported, magenta, red, white, yellow, type Color } from 'colorette';
import { Console } from 'console';
import { inspect, type InspectOptions } from 'util';
import { LoggerLevel, type LoggerLevelOptions } from './LoggerLevel';
import winston from 'winston';

/**
 * The logger class.
 * @since 0.0.1
 */
export class Logger extends BuiltinLogger {
	/**
	 * The console this writes to.
	 * @since 0.0.1
	 */
	public readonly console: Console | winston.Logger;

	/**
	 * The formats supported by the logger.
	 * @since 0.0.1
	 */
	public readonly formats: Map<LogLevel, LoggerLevel>;

	/**
	 * The string `write` will join values by.
	 * @since 0.0.1
	 */
	public readonly join: string;

	/**
	 * The inspect depth when logging objects.
	 * @since 0.0.1
	 */
	public readonly depth: number;

	public constructor(options: LoggerOptions) {
		super(options.level ?? LogLevel.Info);

		options.winstonOptions ??= null;

		const usingWinstonLogger = options.winstonOptions !== null;
		if (usingWinstonLogger) {
			const console = winston.createLogger({
				handleRejections: options.handleErrors ?? true,
				handleExceptions: options.handleErrors ?? true,
				levels: Object.fromEntries(Object.entries(LogLevel).map(([key, value]) => [key.toString(), value])) as any,
				...options.winstonOptions
			});

			this.console = console;
		} else {
			this.console = new Console(options.stdout ?? process.stdout, options.stderr ?? process.stderr);
		}
		this.formats = Logger.createFormatMap(options.format, options.defaultFormat);
		this.join = options.join ?? ' ';
		this.depth = options.depth ?? 0;
	}

	/**
	 * Writes the log message given a level and the value(s).
	 * @param level The log level.
	 * @param values The values to log.
	 */
	public write(level: LogLevel, ...values: readonly unknown[]) {
		if (level < this.level) return;

		const method = this.levels.get(level) ?? 'log';
		const formatter = this.formats.get(level) ?? this.formats.get(LogLevel.None)!;

		if (winston && this.console instanceof winston.Logger) {
			this.console.log(method.toString(), formatter.run(this.preprocess(values)));
		} else (this.console as any)[method](formatter.run(this.preprocess(values)));
	}

	/**
	 * Pre-processes an array of values.
	 * @since 0.0.1
	 * @param values The values to pre-process.
	 */
	protected preprocess(values: readonly unknown[]) {
		const inspectOptions: InspectOptions = { colors: isColorSupported, depth: this.depth };
		return values.map((value) => (typeof value === 'string' ? value : inspect(value, inspectOptions))).join(this.join);
	}

	private get levels() {
		return Reflect.get(BuiltinLogger, 'levels') as Map<LogLevel, LogMethods>;
	}

	/**
	 * Gets whether or not colorette is enabled.
	 * @since 0.0.1
	 */
	public static get stylize() {
		return isColorSupported;
	}

	private static createFormatMap(options: LoggerFormatOptions = {}, defaults: LoggerLevelOptions = options.none ?? {}) {
		return new Map<LogLevel, LoggerLevel>([
			[LogLevel.Trace, Logger.ensureDefaultLevel(options.trace, defaults, gray, 'TRACE')],
			[LogLevel.Debug, Logger.ensureDefaultLevel(options.debug, defaults, magenta, 'DEBUG')],
			[LogLevel.Info, Logger.ensureDefaultLevel(options.info, defaults, cyan, 'INFO')],
			[LogLevel.Warn, Logger.ensureDefaultLevel(options.warn, defaults, yellow, 'WARN')],
			[LogLevel.Error, Logger.ensureDefaultLevel(options.error, defaults, red, 'ERROR')],
			[LogLevel.Fatal, Logger.ensureDefaultLevel(options.fatal, defaults, bgRed, 'FATAL')],
			[LogLevel.None, Logger.ensureDefaultLevel(options.none, defaults, white, '')]
		]);
	}

	private static ensureDefaultLevel(options: LoggerLevelOptions | undefined, defaults: LoggerLevelOptions, color: Color, name: string) {
		if (options) return new LoggerLevel(options);
		return new LoggerLevel({
			...defaults,
			timestamp: defaults.timestamp === null ? null : { ...(defaults.timestamp ?? {}), color },
			infix: name.length ? `${color(name.padEnd(5, ' '))} - ` : ''
		});
	}
}

/**
 * The logger options.
 * @since 0.0.1
 */
export interface LoggerOptions {
	/**
	 * The WriteStream for the output logs.
	 * @since 0.0.1
	 * @default process.stdout
	 */
	stdout?: NodeJS.WriteStream;

	/**
	 * A WriteStream for the error logs.
	 * @since 0.0.1
	 * @default process.stderr
	 */
	stderr?: NodeJS.WriteStream;

	/**
	 * The default options used to fill all the possible values for {@link LoggerOptions.format}.
	 * @since 0.0.1
	 * @default options.format.none ?? {}
	 */
	defaultFormat?: LoggerLevelOptions;

	/**
	 * The options for each log level. LogLevel.None serves to set the default for all keys, where only
	 * {@link LoggerTimestampOptions.timestamp} and {@link LoggerLevelOptions.prefix} would be overridden.
	 * @since 0.0.1
	 * @default {}
	 */
	format?: LoggerFormatOptions;

	/**
	 * The minimum log level.
	 * @since 0.0.1
	 * @default LogLevel.Info
	 */
	level?: LogLevel;

	/**
	 * The string that joins different messages.
	 * @since 0.0.1
	 * @default ' '
	 */
	join?: string;

	/**
	 * The inspect depth when logging objects.
	 * @since 0.0.1
	 * @default 0
	 */
	depth?: number;

	/**
	 *
	 * @default null
	 */
	winstonOptions?: WinstonLoggerOptions | null;

	/**
	 * The option to log errors in the winston logger
	 * @since 0.0.1
	 * @default true
	 */
	handleErrors?: boolean;
}

export interface WinstonLoggerOptions
	extends Omit<winston.LoggerOptions, 'handleExceptions' | 'handleRejections' | 'exceptionHandlers' | 'rejectionHandlers'> {}

/**
 * The logger format options.
 * @since 0.0.1
 */
export interface LoggerFormatOptions {
	/**
	 * The logger options for the lowest log level, used when calling {@link ILogger.trace}.
	 * @since 0.0.1
	 */
	trace?: LoggerLevelOptions;

	/**
	 * The logger options for the debug level, used when calling {@link ILogger.debug}.
	 * @since 0.0.1
	 */
	debug?: LoggerLevelOptions;

	/**
	 * The logger options for the info level, used when calling {@link ILogger.info}.
	 * @since 0.0.1
	 */
	info?: LoggerLevelOptions;

	/**
	 * The logger options for the warning level, used when calling {@link ILogger.warn}.
	 * @since 0.0.1
	 */
	warn?: LoggerLevelOptions;

	/**
	 * The logger options for the error level, used when calling {@link ILogger.error}.
	 * @since 0.0.1
	 */
	error?: LoggerLevelOptions;

	/**
	 * The logger options for the critical level, used when calling {@link ILogger.fatal}.
	 * @since 0.0.1
	 */
	fatal?: LoggerLevelOptions;

	/**
	 * The logger options for an unknown or uncategorised level.
	 * @since 0.0.1
	 */
	none?: LoggerLevelOptions;
}
