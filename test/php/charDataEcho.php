/* assertEcho 'hejfarhejfarhej'*/
$i = 0;
$a = true;
while ($i < 5) {
	if ($a) {
		echo 'hej';
		$a = false;
	} else {
		echo 'far';
		$a = true;
	}
	$i = $i+1;
}
