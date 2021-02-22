

function checkValue (key, value, data)
{
	if (key in data)
	{
		return data[key] == value;
	}

	return false;
}

function checkOr (list, data)
{
	for (let subCondition of list)
	{
		if (checkConditions(subCondition, data))
		{
			return true;
		}
	}
	return false;
}

function checkConditions (conditional, data)
{
	if ("or" in conditional)
	{
		return checkOr(conditional.or, data);
	}
	else if ("not" in conditional)
	{
		return !checkConditions(conditional.not, data)
	}
	else
	{
		for (let key in conditional)
		{
			if (!checkValue(key, conditional[key], data))
			{
				return false;
			}
		}
		return true;
	}
}

function evalConditional (conditional, data)
{
	return checkConditions(conditional, data);
}

module.exports = { evalConditional }