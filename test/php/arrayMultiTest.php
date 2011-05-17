/* assertEcho 'hello world'*/
$arr['foo']['bar'] = 'hello';
$arr[1] = 'world';
$arr['foo']['2'] = ' ';

echo $arr['foo']['bar'].$arr['foo'][2].$arr[1];

