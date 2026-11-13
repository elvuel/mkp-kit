namespace MkpKit.Diagnostics;

public class MkpException : Exception
{
    public MkpException(string message) : base(message) { }
}

public sealed class TransportNotConfiguredException : MkpException
{
    public TransportNotConfiguredException() : base("serial transport is not configured") { }
}

public sealed class DirectiveTimeoutException : MkpException
{
    public DirectiveTimeoutException(string directive, int timeoutMs)
        : base($"directive timeout: {directive} after {timeoutMs}ms")
    {
    }
}

public sealed class DirectiveExecutionFailedException : MkpException
{
    public DirectiveExecutionFailedException(string directive)
        : base($"directive execution failed: {directive}")
    {
    }
}

public sealed class DirectiveParseFailedException : MkpException
{
    public DirectiveParseFailedException(string directive, string detail)
        : base($"directive parse failed: {directive} ({detail})")
    {
    }
}
